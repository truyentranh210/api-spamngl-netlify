/**
 * Hàm xử lý cho endpoint /home, hiển thị hướng dẫn sử dụng API.
 */
exports.handler = async (event, context) => {
    // Chỉ cho phép phương thức GET
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const usage = {
        message: "Chào mừng bạn đến với zNGL API!",
        endpoints: {
            "/api/spamngl": {
                description: "Gửi tin nhắn NGL hàng loạt.",
                method: "GET",
                parameters: {
                    username: "Tên người dùng NGL hoặc link NGL (bắt buộc).",
                    threads: "Số luồng đồng thời, từ 1-500 (mặc định: 50).",
                    thongdiep: "Nội dung tin nhắn (mặc định: trống).",
                    emoji: "'yes' hoặc 'no' để bật/tắt emoji ngẫu nhiên (mặc định: 'no')."
                },
                example: "/api/spamngl?username=your_ngl_username&threads=100&thongdiep=Hello&emoji=yes"
            }
        }
    };

    return {
        statusCode: 200,
        body: JSON.stringify(usage, null, 2), // Dùng null, 2 để format JSON cho đẹp
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };
};
