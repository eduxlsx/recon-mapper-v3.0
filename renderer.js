document.addEventListener("DOMContentLoaded", () => {
  
  const targetInput = document.getElementById("target-input");
  const threadsInput = document.getElementById("threads-input");
  const timeoutInput = document.getElementById("timeout-input");
  const waybackCheckbox = document.getElementById("wayback-checkbox");
  const scanButton = document.getElementById("scan-button");
  const stopButton = document.getElementById("stop-button");
  const pdfButton = document.getElementById("pdf-button");
  const logsDiv = document.getElementById("logs");
  const resultsDiv = document.getElementById("results");
  const statusLabel = document.getElementById("status-
    
  let lastScanResult = null;
  let distributionChart = null;
  let extensionsChart = null;
  let resultBuffer = [];
  let logBuffer = [];

  setInterval(() => {
    if (logBuffer.length > 0) {
      logsDiv.innerText += logBuffer.join("\n") + "\n";
      logsDiv.scrollTop = logsDiv.scrollHeight;
      logBuffer = [];
    }
    if (resultBuffer.length > 0) {
      const fragment = document.createDocumentFragment();
      resultBuffer.forEach((result) => {
        const { category, value } = result;
        let categoryList = document.getElementById(`category-ul-${category}`);
        if (!categoryList) {
          const categoryElement = document.createElement("div");
          categoryElement.className = "result-category";
          const listId = `category-ul-${category}`;
          categoryElement.innerHTML = `<h3>${category.replace(
            /_/g,
            " "
          )}</h3><ul id="${listId}"></ul>`;
          fragment.appendChild(categoryElement);
          categoryList = categoryElement.querySelector("ul");
        }
        const listItem = document.createElement("li");
        listItem.innerText = value;
        categoryList.appendChild(listItem);
      });
      resultsDiv.appendChild(fragment);
      resultBuffer = [];
    }
  }, 250);

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));
      document
        .querySelectorAll(".tab-pane")
        .forEach((pane) => pane.classList.remove("active"));
      button.classList.add("active");
      document
        .getElementById(button.dataset.tab + "-pane")
        .classList.add("active");
    });
  });

  scanButton.addEventListener("click", () => {
    const options = {
      target: targetInput.value,
      threads: parseInt(threadsInput.value, 10),
      timeout: parseInt(timeoutInput.value, 10),
      useWayback: waybackCheckbox.checked,
    };
    if (!options.target) {
      alert("Por favor, insira um alvo.");
      return;
    }

    logsDiv.innerText = "";
    resultsDiv.innerHTML = "";
    lastScanResult = null;
    if (distributionChart) distributionChart.destroy();
    if (extensionsChart) extensionsChart.destroy();
    document.getElementById("stat-time").innerText = "-- s";
    document.getElementById("stat-requests").innerText = "--";
    document.getElementById("stat-rps").innerText = "--";
    document.getElementById("stat-fails").innerText = "--";

    scanButton.style.display = "none";
    stopButton.style.display = "block";
    pdfButton.disabled = true;
    statusLabel.innerText = `Iniciando scan em ${options.target}...`;

    window.electronAPI.startScan(options).then((scanResult) => {
      if (scanResult && scanResult.success) {
        lastScanResult = {
          target: options.target,
          results: scanResult.data,
          stats: scanResult.stats,
        };
        renderAnalytics(scanResult.data, scanResult.stats);
      }
    });
  });

  stopButton.addEventListener("click", () => {
    window.electronAPI.stopScan();
    statusLabel.innerText = "Sinal de parada enviado...";
    stopButton.disabled = true;
  });

  pdfButton.addEventListener("click", () => {
    if (!lastScanResult) {
      alert("Nenhum dado de scan para gerar o relatório.");
      return;
    }
    const distChartImage = distributionChart
      ? distributionChart.toBase64Image("image/png")
      : null;
    const extChartImage = extensionsChart
      ? extensionsChart.toBase64Image("image/png")
      : null;
    const payload = { ...lastScanResult, distChartImage, extChartImage };

    statusLabel.innerText = "Gerando PDF...";
    window.electronAPI.generatePdf(payload).then((result) => {
      if (result.success) {
        statusLabel.innerText = `Relatório salvo em: ${result.path}`;
        alert("Relatório PDF gerado com sucesso!");
      } else {
        statusLabel.innerText = "Geração de PDF cancelada ou falhou.";
      }
    });
  });

  window.electronAPI.onScanUpdate((data) => {
    if (data.type === "log") {
      logBuffer.push(data.message);
      statusLabel.innerText = data.message;
      const finalMessages = ["Scan Concluído!", "Scan Parado pelo Usuário."];
      if (finalMessages.includes(data.message)) {
        stopButton.style.display = "none";
        scanButton.style.display = "block";
        stopButton.disabled = false;
        pdfButton.disabled = false;
      }
    } else if (data.type === "result") {
      resultBuffer.push(data.payload);
    }
  });

  function renderAnalytics(data, stats) {
    if (!data || !stats) {
      console.error("Dados de análise inválidos recebidos.");
      return;
    }

    document.getElementById(
      "stat-time"
    ).innerText = `${stats.durationInSeconds.toFixed(2)} s`;
    document.getElementById("stat-requests").innerText = stats.requestCount;
    document.getElementById("stat-rps").innerText = stats.rps;
    document.getElementById("stat-fails").innerText = stats.failedCount;

    const chartColors = [
      "#61afef",
      "#c678dd",
      "#98c379",
      "#e5c07b",
      "#e06c75",
      "#56b6c2",
    ];

    const distCtx = document
      .getElementById("distribution-chart")
      .getContext("2d");
    if (distributionChart) distributionChart.destroy();

    const distLabels = Object.keys(data).filter(
      (k) => data[k] && data[k].length > 0
    );
    const distDataValues = distLabels.map((k) => data[k].length);

    if (distLabels.length > 0) {
      distributionChart = new Chart(distCtx, {
        type: "pie",
        data: {
          labels: distLabels,
          datasets: [{ data: distDataValues, backgroundColor: chartColors }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    const extCtx = document.getElementById("extensions-chart").getContext("2d");
    if (extensionsChart) extensionsChart.destroy();

    const extCounts = {};
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        const extMatch = file.match(/\.([a-zA-Z0-9]+)$/);
        if (extMatch && extMatch[1] && extMatch[1].length < 7) {
          const ext = `.${extMatch[1]}`;
          extCounts[ext] = (extCounts[ext] || 0) + 1;
        }
      });
    }

    const sortedExt = Object.entries(extCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedExt.length > 0) {
      extensionsChart = new Chart(extCtx, {
        type: "bar",
        data: {
          labels: sortedExt.map((entry) => entry[0]),
          datasets: [
            {
              label: "Ocorrências",
              data: sortedExt.map((entry) => entry[1]),
              backgroundColor: "#98c379",
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
  }
});
