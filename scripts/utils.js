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
 * 从本地File对象中抽取PDF文本
 * @param {File} file PDF文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractPDFTextFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                const totalPageCount = pdf.numPages;
                let texts = [];

                for (let currentPage = 1; currentPage <= totalPageCount; currentPage++) {
                    const page = await pdf.getPage(currentPage);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join('');
                    texts.push(pageText);
                }

                resolve(texts.join(''));
            } catch (error) {
                console.error("Error extracting text from PDF file:", error);
                reject(error);
            }
        };
        reader.onerror = function (error) {
            console.error("Error reading file:", error);
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 通过本地文件路径读取PDF文件
 * @param {string} filePath 本地PDF文件路径，支持file:///格式
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractPDFFromFilePath(filePath) {
    try {
        // 移除file:///前缀，并处理URL编码
        let path = filePath;
        if (path.startsWith('file:///')) {
            path = path.substring(8); // 移除file:///
        }
        path = decodeURIComponent(path); // 处理URL编码

        // 使用fetch API获取文件内容
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`无法获取文件: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);

        const pdf = await pdfjsLib.getDocument(typedArray).promise;
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
        console.error("Error extracting text from PDF path:", error);
        throw error;
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
function displayLoading(message = null) {
    const loadingDiv = document.querySelector('.my-extension-loading');
    if (loadingDiv) {
        // 如果没有提供自定义消息，使用橘子跑动的GIF
        if (message === null) {
            loadingDiv.innerHTML = `
                <img src="images/orange_run.gif" alt="Loading..." style="
                    width: 32px;
                    height: 32px;
                    margin-right: 12px;
                    display: inline-block;
                    vertical-align: middle;
                ">
                <span style="vertical-align: middle;">处理中...</span>
            `;
        } else {
            // 支持 HTML 内容
            loadingDiv.innerHTML = message;
        }
        loadingDiv.style.display = 'flex';
        // 添加居中对齐样式
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.justifyContent = 'center';
    }
}

// 隐藏 loading
function hiddenLoadding() {
    const loadingDiv = document.querySelector('.my-extension-loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
        // 重置为默认的橘子跑动GIF状态
        loadingDiv.innerHTML = `
            <img src="images/orange_run.gif" alt="Loading..." style="
                width: 32px;
                height: 32px;
                margin-right: 12px;
                display: inline-block;
                vertical-align: middle;
            ">
            <span style="vertical-align: middle;">处理中...</span>
        `;
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
    chatLLMAndUIUpdate(getSelectedModel(), newText, []);
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

/**
 * 提取字幕
 * @param {string} url - 视频URL
 * @param {string} format - 字幕格式 (FORMAT_SRT, FORMAT_TEXT, FORMAT_TEXT_WITH_TIMESTAMPS)
 * @returns {string} 格式化后的字幕内容
 */
async function extractSubtitles(url, format = FORMAT_SRT) {
    if(url.includes('youtube.com')) {
        return extractYoutubeSubtitles(url, format);
    } else if(url.includes('bilibili.com')) {
        return extractBilibiliSubtitles(url, format);
    }
}

/**
 * 用 Youtube-transcript.js 提取 youtube 视频字幕
 * @returns
 */
async function extractYoutubeSubtitles(url, format) {
    try {
        // 通过background script获取字幕缓存
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'getYouTubeSubtitles' }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || '获取字幕失败'));
                    return;
                }

                const { cache, installed } = response.data;

                if (!installed) {
                    reject(new Error('字幕拦截器未安装，请刷新YouTube页面后重试'));
                    return;
                }

                const keys = Object.keys(cache);
                if (keys.length === 0) {
                    reject(new Error('暂无缓存字幕，请先播放视频或点击CC字幕按钮'));
                    return;
                }

                // 优先选择非自动生成的字幕
                let selectedKey = keys.find(k => !k.endsWith('_auto'));
                if (!selectedKey) {
                    // 如果都是自动生成的，选择第一个
                    selectedKey = keys[0];
                }

                const subtitleData = cache[selectedKey].data;

                // 转换YouTube字幕格式
                const converted = youtubeSubtitlesToFormat(subtitleData, format);
                resolve(converted);
            });
        });
    } catch (error) {
        console.error('Error fetching YouTube subtitles:', error);
        throw new Error(`视频字幕获取失败: ${error.message}`);
    }
}

/**
 * 获取bilibili 视频字幕
 * @param {string} paramURL
 * @returns
 */
async function extractBilibiliSubtitles(paramURL, format) {
    const url = new URL(paramURL);
    const pathSearchs = {}
    url.search.slice(1).replace(/([^=&]*)=([^=&]*)/g, (matchs, a, b, c) => pathSearchs[a] = b)

    // bvid or aid
    let aidOrBvid = pathSearchs.bvid; // Check watchlater list first
    if (!aidOrBvid) {
        let path = url.pathname;
        if (path.endsWith('/')) {
          path = path.slice(0, -1);
        }
        const paths = path.split('/');
        aidOrBvid = paths[paths.length - 1]; // Get from video path e.g. /video/BVxxxx
      }

    if (!aidOrBvid) {
        throw new Error('无法从URL中提取 BVID 或 AID');
    }

    // Get the page number (p parameter) from URL, default to 1
    const pageNumber = parseInt(pathSearchs.p) || 1;

    let aid;
    let cid;

    try {
        if (aidOrBvid.toLowerCase().startsWith('bv')) {
            // If it's a bvid, get aid and cid from the view API
            const bvidResponse = await fetch(
                `https://api.bilibili.com/x/web-interface/view?bvid=${aidOrBvid}`,
                { credentials: 'include' } // Removed USER_AGENT
            );
            const bvidData = await bvidResponse.json();
            if (bvidData.code !== 0 || !bvidData.data) {
                throw new Error(`获取视频信息失败: ${bvidData.message || '未知错误'}`);
            }
            aid = bvidData.data.aid;

            // Get cid of the specified page
            if (!bvidData.data.pages || bvidData.data.pages.length === 0) {
                 throw new Error('无法获取视频的分P信息');
            }

            // Check if the requested page exists
            if (pageNumber > bvidData.data.pages.length) {
                throw new Error(`请求的页码 ${pageNumber} 超出了视频的总页数 ${bvidData.data.pages.length}`);
            }

            // Get cid of the specified page (page number is 1-based, array is 0-based)
            cid = bvidData.data.pages[pageNumber - 1].cid;

        } else if (aidOrBvid.toLowerCase().startsWith('av')) {
            // If it's an avid, use it directly and get cid from pagelist API
            aid = aidOrBvid.slice(2); // Remove "av" prefix
            const pageListResponse = await fetch(
                `https://api.bilibili.com/x/player/pagelist?aid=${aid}`,
                { credentials: 'include' } // Removed USER_AGENT
            );
            const pageListData = await pageListResponse.json();
            if (pageListData.code !== 0 || !pageListData.data || pageListData.data.length === 0) {
                throw new Error(`获取视频分P列表失败: ${pageListData.message || '未知错误'}`);
            }

            // Check if the requested page exists
            if (pageNumber > pageListData.data.length) {
                throw new Error(`请求的页码 ${pageNumber} 超出了视频的总页数 ${pageListData.data.length}`);
            }

            // Get cid of the specified page (page number is 1-based, array is 0-based)
            cid = pageListData.data[pageNumber - 1].cid;
        } else {
            throw new Error('无法识别的视频ID格式 (非BV或AV号)');
        }

        if (!aid || !cid) {
             throw new Error('未能成功获取视频的 AID 和 CID');
        }

        // Fetch subtitle information using the wbi endpoint
        const subtitleResponse = await fetch(
            `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`,
            { credentials: 'include' } // Removed USER_AGENT
        );
        const subtitleData = await subtitleResponse.json();

        if (subtitleData.code !== 0) {
            throw new Error(`视频字幕获取失败，原因： ${subtitleData.message || '接口返回错误'}`);
        }

        if (!subtitleData.data || !subtitleData.data.subtitle) {
             throw new Error('视频字幕获取失败，原因：接口未返回字幕数据');
        }

        // Handle cases where login might be required
        if (subtitleData.data.need_login_subtitle && (!subtitleData.data.subtitle.subtitles || subtitleData.data.subtitle.subtitles.length === 0)) {
            throw new Error('视频字幕获取失败，原因：需要登录才能获取字幕！');
        }

        let subtitleList = subtitleData.data.subtitle.subtitles || [];

        // Filter out subtitles without a valid URL
        subtitleList = subtitleList.filter(sub => sub.subtitle_url && sub.subtitle_url.trim() !== '');

        if (subtitleList.length === 0) {
            throw new Error('视频字幕获取失败，原因：该视频暂未提供有效字幕！');
        }

        let subtitleUrl = subtitleList[0].subtitle_url;
        // Ensure subtitle URL uses https
        if (subtitleUrl.startsWith('//')) {
            subtitleUrl = 'https:' + subtitleUrl;
        } else if (subtitleUrl.startsWith('http://')) {
            subtitleUrl = subtitleUrl.replace('http://', 'https://');
        }

        // Fetch the actual subtitle JSON
        const subtitleJSONResponse = await fetch(
            subtitleUrl // No headers needed for the subtitle content URL generally
        );
        const subtitleJSONData = await subtitleJSONResponse.json();

        if (!subtitleJSONData || !subtitleJSONData.body) {
             throw new Error('获取字幕内容失败，格式无效');
        }

        const formattedSubtitles = bilibiliSubtitlesJSONToFormat(subtitleJSONData, format);
        return formattedSubtitles;

    } catch (error) {
        console.error('extractBilibiliSubtitles error:', error);
        // Re-throw specific user-friendly errors, or a generic one
        if (error.message.startsWith('视频字幕获取失败') || error.message.startsWith('无法') || error.message.startsWith('未能')) {
             throw error;
        }
        throw new Error(`处理B站字幕时出错: ${error.message}`);
    }
}

/**
 * 将 bilibili 视频字幕的 json 格式 转为 srt 格式
 * @param {json} subtitles
 * @returns
 */
function bilibiliSubtitlesJSONToFormat(subtitles, format) {
    const subtitlesBody = subtitles.body;
    return subtitlesBody.map((sub, index) => {
        if(format == FORMAT_SRT) {
            const startTime = formatTime(sub.from);
            const endTime = formatTime(sub.to);

            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.content}\n`;
        } else if(format == FORMAT_TEXT_WITH_TIMESTAMPS) {
            const startTime = formatTime(sub.from);
            const endTime = formatTime(sub.to);
            return `[${startTime}-${endTime}] ${sub.content}`;
        } else if(format == FORMAT_TEXT) {
            return `${sub.content}`;
        }
    }).join('\n');
}

/**
 * 将 YouTube 视频字幕的 json 格式转换为指定格式
 * @param {object} subtitles - YouTube字幕数据
 * @param {string} format - 目标格式 (FORMAT_SRT 或 FORMAT_TEXT)
 * @returns {string} 转换后的字幕文本
 */
function youtubeSubtitlesToFormat(subtitles, format) {
    const events = subtitles.events || subtitles;
    if (!Array.isArray(events)) {
        throw new Error('无效的字幕数据格式');
    }

    let result = [];
    let index = 1;

    for (const event of events) {
        if (!event.segs || event.segs.length === 0) continue;

        const text = event.segs.map(s => s.utf8 || '').join('').trim();
        if (!text) continue;

        if (format === FORMAT_SRT) {
            const startMs = event.tStartMs || 0;
            const endMs = startMs + (event.dDurationMs || 2000);
            const startTime = msToSrtTime(startMs);
            const endTime = msToSrtTime(endMs);
            result.push(`${index}\n${startTime} --> ${endTime}\n${text}\n`);
            index++;
        } else if (format === FORMAT_TEXT_WITH_TIMESTAMPS) {
            const startMs = event.tStartMs || 0;
            const endMs = startMs + (event.dDurationMs || 2000);
            const startTime = msToSrtTime(startMs);
            const endTime = msToSrtTime(endMs);
            result.push(`[${startTime}-${endTime}] ${text}`);
        } else if (format === FORMAT_TEXT) {
            result.push(text);
        }
    }

    if (result.length === 0) {
        throw new Error('没有找到有效的字幕内容');
    }

    return result.join('\n');
}

/**
 * 将毫秒转换为SRT时间格式 (HH:MM:SS,mmm)
 * @param {number} ms - 毫秒数
 * @returns {string} SRT格式的时间字符串
 */
function msToSrtTime(ms) {
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    const ms2 = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${s},${ms2}`;
}

function formatTime(seconds) {
    const date = new Date(seconds * 1000);
    const hh = pad(date.getUTCHours());
    const mm = pad(date.getUTCMinutes());
    const ss = pad(date.getUTCSeconds());
    const ms = date.getUTCMilliseconds();

    return `${hh}:${mm}:${ss},${ms.toString().padStart(3, '0')}`;
}

function pad(number) {
    return number.toString().padStart(2, '0');
}
