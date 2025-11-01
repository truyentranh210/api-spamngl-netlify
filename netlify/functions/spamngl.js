const axios = require('axios');
const { URLSearchParams } = require('url');

// --- Danh sách User-Agent ---
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/17.4.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"
];

const EMOJIS = [
    "😊", "😎", "😍", "😉", "😁", "😄", "😃", "🙂", "😆", "😅", "🤣", "😂",
    "😋", "😛", "😜", "🤪", "🤩", "🥰", "😇", "🙃", "🥹", "😌", "🤗", "😏",
    "🤭", "🫢", "🫠", "🤫", "😭", "😢", "😥", "😓", "😞", "😔", "🙁", "☹️",
    "😠", "😡", "🤬", "😤", "😖", "😫", "😩", "🥺", "😱", "😨", "😰", "😵",
    "🤯", "😳", "😬", "🫣", "🥴", "🤢", "🤮", "😷", "🤒", "🤕", "🤧", "🥶",
    "🥵", "😈", "👿", "💀", "👻", "👽", "😺", "😸", "😹", "😻", "😼", "😽",
    "🙀", "😿", "😾", "🤡", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤",
    "🤍", "💓", "💗", "💖", "💘", "💝", "💞", "💕"
];

const NGL_URL = "https://ngl.link/api/submit";

// Hàm tiện ích
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomStr = (length = 10) => Math.random().toString(36).substring(2, length + 2);
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Tạo headers cho mỗi yêu cầu với User-Agent ngẫu nhiên.
 */
const getHeaders = (username) => {
    return {
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Host": "ngl.link",
        "Origin": "https://ngl.link",
        "Referer": `https://ngl.link/${username}`,
        "User-Agent": getRandomItem(USER_AGENTS),
        "X-Requested-With": "XMLHttpRequest",
    };
};

/**
 * Gửi một tin nhắn đến NGL, có xử lý retry khi bị rate limit.
 */
async function submitQuestion(username, question, enableEmoji) {
    const fullQuestion = enableEmoji ? `${question} ${getRandomItem(EMOJIS)}` : question;
    const data = new URLSearchParams({
        username: username,
        question: fullQuestion,
        deviceId: randomStr(36),
        gameSlug: "",
        referrer: "",
    });

    let retries = 5; // Thử lại tối đa 5 lần
    while (retries > 0) {
        try {
            const headers = getHeaders(username);
            await axios.post(NGL_URL, data.toString(), { headers, timeout: 20000 });
            console.log(`Gửi thành công tin nhắn tới ${username}`);
            return true; // Thành công
        } catch (error) {
            if (error.response && error.response.status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '15', 10);
                console.warn(`Bị giới hạn yêu cầu (429). Đang chờ ${retryAfter} giây...`);
                await sleep(retryAfter * 1000);
            } else {
                console.error(`Gửi tin nhắn tới ${username} thất bại:`, error.message);
                retries--;
                await sleep(2000); // Chờ 2 giây trước khi thử lại lỗi khác
            }
        }
    }
    console.error(`Không thể gửi tin nhắn tới ${username} sau nhiều lần thử.`);
    return false;
}

/**
 * Hàm chính xử lý yêu cầu API, được cấu hình để chạy trong nền.
 * This is a background function.
 */
exports.handler = async (event, context) => {
    // Chỉ cho phép phương thức GET
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { username, threads: threadsStr = '50', thongdiep = '', emoji = 'no' } = event.queryStringParameters;

    // --- Xác thực tham số ---
    if (!username) {
        return { statusCode: 400, body: JSON.stringify({ error: "Thiếu tham số 'username'" }) };
    }

    const threads = parseInt(threadsStr, 10);
    if (isNaN(threads) || threads < 1 || threads > 500) {
        return { statusCode: 400, body: JSON.stringify({ error: "Số luồng ('threads') phải là số nguyên từ 1 đến 500" }) };
    }

    const enableEmoji = emoji.toLowerCase() === 'yes';
    const totalRequests = threads * 5;

    // --- Chạy tác vụ trong nền ---
    // Netlify sẽ tự động chạy phần code sau khi return nếu đây là background function.
    // Chúng ta không cần `await` lời gọi `runSpamTask`
    runSpamTask(username, thongdiep, enableEmoji, threads, totalRequests);

    // --- Trả về phản hồi ngay lập tức ---
    return {
        statusCode: 202, // Accepted
        body: JSON.stringify({
            status: "success",
            message: `Đã chấp nhận yêu cầu. Bắt đầu quá trình gửi ${totalRequests} tin nhắn đến '${username}' trong nền.`,
            details: {
                username,
                question: thongdiep || "(trống)",
                threads,
                enable_emoji: enableEmoji,
                total_requests: totalRequests
            }
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    };
};

/**
 * Hàm thực thi tác vụ gửi tin nhắn.
 */
async function runSpamTask(username, question, enableEmoji, concurrencyLimit, totalRequests) {
    console.log(`Bắt đầu gửi ${totalRequests} tin nhắn tới '${username}' với ${concurrencyLimit} luồng đồng thời.`);

    const tasks = [];
    for (let i = 0; i < totalRequests; i++) {
        tasks.push(() => submitQuestion(username, question, enableEmoji));
    }

    let running = 0;
    let completed = 0;
    let taskIndex = 0;

    function runNext() {
        if (taskIndex >= tasks.length) {
            if (running === 0) {
                console.log(`Hoàn thành! Đã xử lý ${completed}/${totalRequests} yêu cầu cho '${username}'.`);
            }
            return;
        }

        while (running < concurrencyLimit && taskIndex < tasks.length) {
            const task = tasks[taskIndex];
            taskIndex++;
            running++;

            task().then(() => {
                running--;
                completed++;
                runNext();
            });
        }
    }

    runNext();
}
