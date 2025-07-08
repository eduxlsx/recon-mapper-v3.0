# 🗺️ ReconMapper - Electron Edition

![Versão](https://img.shields.io/badge/version-5.0-blue.svg)
![Licença](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-ativo-brightgreen.svg)

Uma ferramenta de Reconhecimento Web e Descoberta de Superfície de Ataque com interface gráfica moderna, construída com Electron e Node.js.

![Screenshot da Aplicação](https://i.imgur.com/gK49D3H.png)
*A interface principal do ReconMapper em ação.*

## 🎯 Visão Geral

O ReconMapper é um robô de reconhecimento web de alta performance que fornece uma descoberta compreensiva da superfície de ataque para profissionais de segurança, pent testers e caçadores de recompensas de bugs (bug bounty).

Diferente de ferramentas de linha de comando, ele oferece uma experiência visual e interativa, com painéis de configuração, gráficos dinâmicos e geração de relatórios em PDF.

## 🚀 Funcionalidades Principais

#### Capacidades de Descoberta:
* **Subdomínios:** Descoberta automática de subdomínios.
* **Diretórios:** Enumeração da hierarquia completa de caminhos.
* **Arquivos:** Descoberta de recursos estáticos e documentos.
* **Parâmetros de URL:** Extração de parâmetros de query string.
* **Inputs de Formulário:** Encontra campos de formulários HTML (`<input>`, `<textarea>`, `<select>`).
* **Endpoints de API:** Detecção de respostas do tipo JSON.

#### Análise e Relatórios:
* **Dashboard de Análise:** Métricas de desempenho do scan (tempo, requisições por segundo, falhas).
* **Gráficos Dinâmicos:** Gráficos de pizza e de barras para visualizar a distribuição dos recursos e as extensões de arquivo mais comuns.
* **Relatórios em PDF:** Geração de relatórios completos com um clique, incluindo métricas, gráficos e todos os dados encontrados.

#### Funcionalidades Técnicas:
* **Scan Concorrente:** Utiliza múltiplos "workers" para acelerar o processo de crawling.
* **Controle Total:** A interface permite configurar o número de workers, timeouts e usar a Wayback Machine para encontrar dados históricos.
* **Parada Instantânea:** Permite interromper um scan em andamento a qualquer momento, finalizando com os dados coletados até então.
* **Interface Reativa:** Construída para ser rápida e não travar, mesmo durante scans intensos.

## 🛠️ Tecnologias Utilizadas

* **Backend:** Electron, Node.js
* **Requisições de Rede:** Axios
* **Parsing de HTML:** Cheerio
* **Frontend:** HTML5, CSS3, JavaScript
* **Gráficos:** Chart.js

## 📋 Pré-requisitos

Para rodar este projeto, você precisará ter instalado:

* [Node.js](https://nodejs.org/) (versão LTS recomendada)

## ⚙️ Instalação e Setup

1.  Clone este repositório (ou simplesmente tenha a pasta do projeto):
    ```bash
    git clone https://github.com/eduxlsx/recon-mapper-v3.0
    ```
2.  Navegue até a pasta do projeto:
    ```bash
    cd reconmapper-electron
    ```
3.  Instale todas as dependências:
    ```bash
    npm install
    ```

## ⚡ Como Usar

1.  Para iniciar a aplicação, execute o seguinte comando no seu terminal:
    ```bash
    npm start
    ```
2.  A janela do ReconMapper aparecerá.
3.  **Configure o Scan:**
    * No campo **Alvo**, insira o domínio que deseja escanear (ex: `exemplo.com`).
    * Ajuste o número de **Workers**, **Timeout** e **Profundidade** conforme sua necessidade.
    * Marque a caixa **Usar Wayback Machine** para uma busca mais profunda por links históricos.
4.  **Inicie e Monitore:**
    * Clique em **▶ Iniciar Scan**. O botão mudará para **■ Parar Scan**, permitindo que você interrompa o processo a qualquer momento.
    * Acompanhe a atividade em tempo real na aba **Logs**.
    * Veja os resultados sendo preenchidos na aba **Resultados**.
    * Após o scan (concluído ou parado), explore as métricas e gráficos na aba **Gráficos & Análise**.
5.  **Gere o Relatório:**
    * Clique no botão **Baixar Relatório PDF** no rodapé para salvar um documento completo com todos os dados e gráficos do seu scan.

## 📄 Licença

Projeto desenvolvido por https://github.com/m2hcz .



Versão 3.0 desenvolvida por: https://github.com/eduxlsx .

## Repositório Original

https://github.com/m2hcz/reconmapper-v2.0