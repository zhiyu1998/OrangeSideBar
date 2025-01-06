/**
 * 用 Readability.js 抽取文章正文F
 * @param {string} format 
 * @returns 
 */
function extractContent(format) {
    const article = new Readability(document.cloneNode(true)).parse();
    const title = article.title;
    var content = article.content;
    if (format === FORMAT_TEXT) {
        content = article.textContent;
    }
    const result = title + "\n" + content;
    return result;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('/scripts/third/pdf.worker.min.js');

/**
 * 使用 pdf.js 抽取 PDF 正文
 * @param {string} pdfUrl 
 * @returns 
 */
async function extractPDFText(pdfUrl) {
    try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const totalPageCount = pdf.numPages;
        let texts = [];

        for (let currentPage = 1; currentPage <= totalPageCount; currentPage++) {
            const page = await pdf.getPage(currentPage);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join('');
            texts.push(pageText);
        }

        return texts.join('');
    } catch (error) {
        console.error("Error extracting text from PDF:", error);
        throw error;  // Optionally rethrow the error
    }
}

/**
 * 根据 url 判断是否访问的是 PDF 文件
 * @param {string} url 
 * @returns 
 */
function isPDFUrl(url) {
    url = url.toLowerCase();
    if (url.endsWith('.pdf')) {
        return true;
    }
    // arxiv 的特殊处理一下，它不是以.pdf后缀结束的
    const pattern = /^https?:\/\/arxiv\.org\/pdf\/\d+\.\d+(v\d+)?$/;
    return pattern.test(url);
}

/**
 * 解析 base64 以获取 mimeType 和 data
 * @param {string} base64String 
 * @returns 
 */
function parseBase64Image(base64String) {
    // 正则表达式用于匹配Base64字符串的格式
    const regex = /^data:(.+);base64,(.*)$/;
    const matches = base64String.match(regex);

    if (matches && matches.length === 3) {
        return {
            mimeType: matches[1],
            data: matches[2]
        };
    } else {
        throw new Error('Invalid Base64 string');
    }
}

// 创建AI回复div
function createAIMessageDiv() {
    const aiContentDiv = document.createElement('div');
    aiContentDiv.className = 'ai-message';
    const contentDiv = document.querySelector('.chat-content');
    contentDiv.appendChild(aiContentDiv);
}

// 展示 loading
function displayLoading(message = 'AI 思考中...') {
    const loadingDiv = document.querySelector('.my-extension-loading');
    if (loadingDiv) {
        loadingDiv.textContent = message;
        loadingDiv.style.display = 'flex';
    }
}

// 隐藏 loading
function hiddenLoadding() {
    const loadingDiv = document.querySelector('.my-extension-loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
        loadingDiv.textContent = 'AI 思考中...'; // 恢复默认文本
    }
}

// 获取当前时间的函数
function getCurrentTime() {
    const now = new Date();

    // 获取日期
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');

    // 获取时间
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 生成唯一标识
function generateUniqueId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


function editUserMessage(messageDiv, originalText) {
    const textArea = document.createElement('textarea');
    textArea.value = originalText;
    textArea.className = 'edit-message-textarea';

    const saveButton = document.createElement('button');
    saveButton.className = 'save-message-btn';
    saveButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
    `;

    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-message-btn';
    cancelButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    messageDiv.innerHTML = '';
    messageDiv.appendChild(textArea);
    messageDiv.appendChild(saveButton);
    messageDiv.appendChild(cancelButton);

    saveButton.onclick = () => saveEditedMessage(messageDiv, textArea.value);
    cancelButton.onclick = () => cancelEdit(messageDiv, originalText);
}

function saveEditedMessage(messageDiv, newText) {
    messageDiv.innerHTML = newText;

    // Add edit button back
    const editButton = document.createElement('button');
    editButton.className = 'edit-message-btn';
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editButton.onclick = () => editUserMessage(messageDiv, newText);
    messageDiv.appendChild(editButton);

    // Remove all subsequent messages
    let nextElement = messageDiv.nextElementSibling;
    while (nextElement) {
        const elementToRemove = nextElement;
        nextElement = nextElement.nextElementSibling;
        elementToRemove.remove();
    }

    // Trigger new AI response
    const modelSelection = document.getElementById('model-selection');
    chatLLMAndUIUpdate(modelSelection.value, newText, []);
}

function cancelEdit(messageDiv, originalText) {
    messageDiv.innerHTML = originalText;

    // Add edit button back
    const editButton = document.createElement('button');
    editButton.className = 'edit-message-btn';
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editButton.onclick = () => editUserMessage(messageDiv, originalText);
    messageDiv.appendChild(editButton);
}

async function getBaseUrlAndApiKey(model) {
    return new Promise((resolve) => {
        chrome.storage.local.get([model], function (result) {
            const modelInfo = result[model] || {};
            resolve({
                baseUrl: modelInfo.baseUrl,
                apiKey: modelInfo.apiKey
            });
        });
    });
}
