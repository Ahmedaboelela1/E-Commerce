import net from 'node:net';

/** Loopback-only SMTP fixture. No message leaves the test machine. */
export async function smtpCapture({rejectFirst = false} = {}) {
    const messages = [], authUsers = [], connections = new Set();
    let remainingFailures = rejectFirst ? 1 : 0;
    const server = net.createServer(socket => {
        connections.add(socket); socket.on('close', () => connections.delete(socket));
        socket.setEncoding('utf8'); socket.write('220 localhost test SMTP\r\n');
        let pending = '', data = false, lines = [], recipients = [];
        socket.on('data', chunk => {
            pending += chunk;
            while (pending.includes('\r\n')) {
                const end = pending.indexOf('\r\n'), line = pending.slice(0,end);
                pending = pending.slice(end+2);
                if (data) {
                    if (line === '.') {
                        data = false;
                        if (remainingFailures) { remainingFailures--; socket.write('451 Temporary test failure\r\n'); }
                        else { messages.push({raw:lines.join('\r\n'),recipients:[...recipients]}); socket.write('250 Queued\r\n'); }
                        lines = []; recipients = [];
                    } else lines.push(line.startsWith('..') ? line.slice(1) : line);
                } else if (/^EHLO|^HELO/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
                else if (/^AUTH PLAIN /i.test(line)) {
                    // Retain only the username, never the password from the AUTH payload.
                    authUsers.push(Buffer.from(line.slice(11),'base64').toString('utf8').split('\0')[1]);
                    socket.write('235 Authentication successful\r\n');
                }
                else if (/^MAIL FROM:/i.test(line)) { recipients = []; socket.write('250 OK\r\n'); }
                else if (/^RCPT TO:/i.test(line)) { recipients.push(line.slice(8).trim()); socket.write('250 OK\r\n'); }
                else if (/^DATA$/i.test(line)) { data = true; socket.write('354 End with a dot\r\n'); }
                else if (/^QUIT$/i.test(line)) socket.end('221 Bye\r\n');
                else socket.write('250 OK\r\n');
            }
        });
        socket.on('error', () => {});
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    return {port:server.address().port,messages,authUsers,async close(){for(const socket of connections)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}
