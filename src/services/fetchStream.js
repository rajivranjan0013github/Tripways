export const fetchStream = (url, options, onMessage, onDone, onError) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url, true);
        
        if (options.headers) {
            Object.keys(options.headers).forEach(key => {
                xhr.setRequestHeader(key, options.headers[key]);
            });
        }

        let seenBytes = 0;
        let buffer = '';

        xhr.onprogress = () => {
            const newText = xhr.responseText.substring(seenBytes);
            seenBytes = xhr.responseText.length;
            
            buffer += newText;

            const parts = buffer.split('\n\n');
            let lastEventEndIndex = -1;
            
            // Do not process the very last part yet if it wasn't split perfectly by \n\n.
            // It could be an incomplete chunk waiting for the next TCP frame.
            for (let i = 0; i < parts.length - 1; i++) {
                const block = parts[i];
                if (!block.trim()) continue;
                
                const lines = block.split('\n');
                let eventType = '';
                let eventData = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) eventType = line.slice(7);
                    if (line.startsWith('data: ')) eventData = line.slice(6);
                }
                if (!eventType || !eventData) continue;

                try {
                    const parsed = JSON.parse(eventData);
                    onMessage(eventType, parsed);
                } catch (e) {
                    console.warn('fetchStream: failed to parse JSON chunk:', eventData.substring(0, 100));
                }
            }
            
            // Retain the remaining incomplete chunk in the buffer for the next progress event
            buffer = parts[parts.length - 1];
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (onDone) onDone();
                resolve();
            } else {
                const err = new Error('Backend failed to respond');
                if (onError) onError(err);
                reject(err);
            }
        };

        xhr.onerror = () => {
            const err = new Error('Network error occurred');
            if (onError) onError(err);
            reject(err);
        };

        if (options.body) {
            xhr.send(options.body);
        } else {
            xhr.send();
        }
    });
};
