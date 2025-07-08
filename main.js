const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let mainWindow;
let scanController;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, "assets/icon.png")
    });
    mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.on("stop-scan", () => {
    if (scanController) {
        scanController.abort();
    }
});

ipcMain.handle("start-scan", async (event, options) => {
    scanController = new AbortController();
    const { target, threads, timeout, useWayback } = options;
    const startUrl = `https://` + target.replace(/^(https?:\/\/)?/, "");
    const baseDomain = new URL(startUrl).hostname;

    const queue = new Set([startUrl]);
    const visited = new Set([startUrl]);
    const results = {
        subdomains: new Set([baseDomain]),
        directories: new Set(),
        files: new Set(),
        parameters: new Set(),
        inputs: new Set(),
        api_endpoints: new Set()
    };
    const startTime = Date.now();
    let requestCount = 0;
    let failedCount = 0;

    const sendLog = (message) => event.sender.send("scan-update", { type: "log", message });
    const sendResult = (category, value) => {
        if (value && !results[category].has(value)) {
            results[category].add(value);
            event.sender.send("scan-update", { type: "result", payload: { category, value } });
        }
    };

    sendLog(`Iniciando scan em ${baseDomain} com ${threads} workers...`);
    sendResult('Subdomains', baseDomain);

    if (useWayback && !scanController.signal.aborted) {
        sendLog("Consultando a Wayback Machine...");
        try {
            const waybackUrl = `https://web.archive.org/cdx/search/cdx?url=*.${baseDomain}/*&output=json&fl=original&collapse=urlkey`;
            const response = await axios.get(waybackUrl, { timeout: 20000, signal: scanController.signal });
            if (response.data && response.data.length > 1) {
                response.data.slice(1).forEach((item) => queue.add(item[0]));
                sendLog(`Encontrados ${response.data.length - 1} URLs históricos.`);
            }
        } catch (error) {
            if (!axios.isCancel(error)) {
               sendLog(`Erro ao consultar a Wayback Machine: ${error.message}`);
            }
        }
    }

    const processUrl = async (url, signal) => {
        try {
            requestCount++;
            sendLog(`Processando: ${url}`);
            const response = await axios.get(url, {
                signal,
                headers: { "User-Agent": "ReconMapper Pro/Final" },
                timeout: timeout * 1000,
                httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false }),
            });
            const parsedUrl = new URL(url);
            if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
                sendResult("files", parsedUrl.pathname);
                const pathParts = parsedUrl.pathname.split("/").filter((p) => p);
                pathParts.pop();
                if (pathParts.length > 0) sendResult("directories", "/" + pathParts.join("/"));
            }
            parsedUrl.searchParams.forEach((_, key) => sendResult("parameters", key));
            if (response.headers["content-type"]?.includes("application/json")) {
                sendResult("api_endpoints", url);
                return;
            }
            const $ = cheerio.load(response.data);
            $('a[href], link[href], script[src], img[src]').each((_, el) => {
                const link = $(el).attr("href") || $(el).attr("src");
                if (link) {
                    try {
                        const absoluteUrl = new URL(link, url).href;
                        if (absoluteUrl.includes(baseDomain)) {
                           queue.add(absoluteUrl);
                        }
                    } catch (e) {}
                }
            });
             $('form input, form textarea, form select').each((_, el) => {
                const type = el.tagName;
                const name = $(el).attr("name") || $(el).attr("id");
                if (name) sendResult("inputs", `${type}:${name}`);
            });
        } catch (error) {
            if (!axios.isCancel(error)) {
                failedCount++;
                sendLog(`Erro: ${url} - ${error.message}`);
            }
        }
    };
    
    const queueArray = Array.from(queue);
    const activeWorkers = new Set();
    
    while (queueArray.length > 0 || activeWorkers.size > 0) {
        if (scanController.signal.aborted) {
            sendLog("Sinal de parada recebido... finalizando tarefas em andamento...");
            break; 
        }
        if (activeWorkers.size < threads && queueArray.length > 0) {
            const currentUrl = queueArray.shift();
            if (visited.has(currentUrl)) continue;
            visited.add(currentUrl);
            const workerPromise = processUrl(currentUrl, scanController.signal)
                .finally(() => activeWorkers.delete(workerPromise));
            activeWorkers.add(workerPromise);
        } else if (activeWorkers.size > 0) {
            await Promise.race(activeWorkers);
        } else {
            break;
        }
    }
    
    await Promise.allSettled(Array.from(activeWorkers));
    
    const endTime = Date.now();
    const durationInSeconds = (endTime - startTime) / 1000;
    const rps = durationInSeconds > 0 ? (requestCount / durationInSeconds).toFixed(2) : 0;
    const finalMessage = scanController.signal.aborted ? 'Scan Parado pelo Usuário.' : 'Scan Concluído!';
    sendLog(finalMessage);

    const finalStats = { durationInSeconds, requestCount, failedCount, rps };
    const finalData = Object.fromEntries(
        Object.entries(results).map(([k, v]) => [k, Array.from(v)])
    );
    return { success: true, data: finalData, stats: finalStats };
});

// --- LÓGICA DE ANÁLISE COM IA (ADICIONADA E CORRIGIDA) ---
ipcMain.handle('analyze-with-ai', async (event, scanData) => {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, message: "Chave da API do Gemini não encontrada no arquivo .env" };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const dataForPrompt = JSON.stringify(scanData.results, null, 2);
    
    const prompt = `
        Você é um especialista em segurança da informação (pentester) e sua tarefa é analisar os resultados de um scan de reconhecimento de um site.
        
        **Instruções:**
        1.  Analise os dados brutos do scan fornecidos abaixo.
        2.  Identifique de 3 a 5 pontos de atenção de segurança que você considera mais relevantes.
        3.  Para cada ponto, crie uma seção com:
            - **Ponto de Atenção:** Um título claro (ex: "Exposição de API do WordPress (WP-JSON)").
            - **Risco:** Uma explicação simples do porquê isso é um risco (ex: "Permite que atacantes enumerem usuários, posts e plugins, facilitando a busca por vulnerabilidades conhecidas.").
            - **Sugestão de Correção:** Uma ou duas ações práticas para mitigar o risco (ex: "Restringir o acesso aos endpoints da API WP-JSON usando um firewall de aplicação web (WAF) ou desativar endpoints não utilizados.").
        4.  Seja direto, claro e formate a resposta em Markdown. Não inclua saudações ou despedidas.

        **Dados Brutos do Scan:**
        \`\`\`json
        ${dataForPrompt}
        \`\`\`
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return { success: true, analysis: text };
    } catch (error) {
        console.error("Erro na API do Gemini:", error);
        return { success: false, message: `Erro na API do Gemini: ${error.message}` };
    }
});


ipcMain.handle("generate-pdf", async (event, scanData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: "Salvar Relatório em PDF",
        defaultPath: `ReconMapper-Report-${scanData.target}.pdf`,
        filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
    });

    if (result.canceled) return { success: false };

    let htmlContent = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#333;margin:40px}
        h1{color:#2c3e50;border-bottom:2px solid #3498db}
        h2{color:#34495e;border-bottom:1px solid #bdc3c7;padding-bottom:5px;margin-top:30px}
        pre{background-color:#f4f4f4;padding:15px;border-radius:5px;white-space:pre-wrap;word-wrap:break-word;font-size:0.9em;border:1px solid #ddd}
        ul{list-style-type:none;padding-left:0}
        li{background-color:#f4f4f4;margin-bottom:5px;padding:8px;border-radius:4px;word-break:break-all;font-size:.9em}
        .summary-table{border-collapse:collapse;width:100%;margin-top:20px}
        .summary-table th,.summary-table td{border:1px solid #ddd;padding:8px;text-align:left}
        .summary-table th{background-color:#ecf0f1}
        .chart-container{text-align:center;margin-top:20px;page-break-inside:avoid}
        .chart-container img{max-width:90%}
        </style></head><body>
        <h1>Relatório de Reconhecimento</h1>
        <p><strong>Alvo:</strong> ${scanData.target}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
        <h2>Resumo das Métricas</h2>
        <table class="summary-table">
            <tr><th>Métrica</th><th>Valor</th></tr>
            <tr><td>Tempo de Scan</td><td>${scanData.stats.durationInSeconds.toFixed(2)} segundos</td></tr>
            <tr><td>Requisições Feitas</td><td>${scanData.stats.requestCount}</td></tr>
            <tr><td>Requisições por Segundo (RPS)</td><td>${scanData.stats.rps}</td></tr>
            <tr><td>Falhas</td><td>${scanData.stats.failedCount}</td></tr>
        </table>`;

    if (scanData.aiAnalysisText) {
        htmlContent += `<h2>Análise de Segurança por IA</h2><pre>${scanData.aiAnalysisText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }

    if (scanData.distChartImage || scanData.extChartImage) {
        htmlContent += `<h2>Visualização de Dados</h2>`;
        if(scanData.distChartImage) htmlContent += `<div class="chart-container"><h3>Distribuição de Recursos</h3><img src="${scanData.distChartImage}"></div>`;
        if(scanData.extChartImage) htmlContent += `<div class="chart-container"><h3>Top 5 Extensões de Arquivo</h3><img src="${scanData.extChartImage}"></div>`;
    }

    for (const [category, items] of Object.entries(scanData.results)) {
        if (items.length > 0) {
            htmlContent += `<h2>${category.replace(/_/g, " ")} (${items.length})</h2><ul>`;
            items.sort().forEach((item) => { htmlContent += `<li>${item.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`; });
            htmlContent += `</ul>`;
        }
    }
    htmlContent += `</body></html>`;

    const pdfWin = new BrowserWindow({ show: false });
    await pdfWin.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`);
    
    try {
        const pdfData = await pdfWin.webContents.printToPDF({ pageSize: "A4" });
        fs.writeFileSync(result.filePath, pdfData);
        pdfWin.close();
        return { success: true, path: result.filePath };
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        pdfWin.close();
        return { success: false };
    }
});