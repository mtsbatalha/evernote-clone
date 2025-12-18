/**
 * Yjs WebSocket Server for Real-time Collaboration
 * 
 * This server handles document synchronization using Yjs CRDT.
 * Multiple clients can edit the same document simultaneously,
 * and changes are merged automatically without conflicts.
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const PORT = parseInt(process.env.WS_PORT || '1234', 10);

// Message types
const messageSync = 0;
const messageAwareness = 1;

// Store for documents and connections
const docs = new Map<string, {
    doc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    connections: Set<WebSocket>;
}>();

// Get or create a document
function getDoc(docName: string) {
    if (!docs.has(docName)) {
        const doc = new Y.Doc();
        const awareness = new awarenessProtocol.Awareness(doc);

        docs.set(docName, {
            doc,
            awareness,
            connections: new Set(),
        });

        // Clean up empty docs after some time
        awareness.on('update', () => {
            const docData = docs.get(docName);
            if (docData && docData.connections.size === 0) {
                // Keep doc for 5 minutes after last connection
                setTimeout(() => {
                    const currentDocData = docs.get(docName);
                    if (currentDocData && currentDocData.connections.size === 0) {
                        docs.delete(docName);
                        console.log(`🗑️ Cleaned up document: ${docName}`);
                    }
                }, 5 * 60 * 1000);
            }
        });
    }

    return docs.get(docName)!;
}

// Broadcast to all connections except sender
function broadcast(docName: string, message: Uint8Array, exclude?: WebSocket) {
    const docData = docs.get(docName);
    if (!docData) return;

    docData.connections.forEach((conn) => {
        if (conn !== exclude && conn.readyState === WebSocket.OPEN) {
            conn.send(message);
        }
    });
}

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 Yjs WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (conn, req) => {
    // Extract document name from URL path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const docName = url.pathname.slice(1) || 'default';

    console.log(`📝 Client connected to document: ${docName}`);

    const docData = getDoc(docName);
    docData.connections.add(conn);

    // Send initial sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, docData.doc);
    conn.send(encoding.toUint8Array(encoder));

    // Send awareness state
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
            docData.awareness,
            Array.from(docData.awareness.getStates().keys())
        )
    );
    conn.send(encoding.toUint8Array(awarenessEncoder));

    // Handle messages
    conn.on('message', (data: Buffer) => {
        try {
            const message = new Uint8Array(data);
            const decoder = decoding.createDecoder(message);
            const messageType = decoding.readVarUint(decoder);

            switch (messageType) {
                case messageSync: {
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageSync);
                    const syncMessageType = syncProtocol.readSyncMessage(
                        decoder,
                        encoder,
                        docData.doc,
                        null
                    );

                    if (syncMessageType !== 0) {
                        // Broadcast sync updates to other clients
                        if (encoding.length(encoder) > 1) {
                            conn.send(encoding.toUint8Array(encoder));
                        }
                    }

                    // If we received updates, broadcast to others
                    if (syncMessageType === 2) {
                        const updateEncoder = encoding.createEncoder();
                        encoding.writeVarUint(updateEncoder, messageSync);
                        syncProtocol.writeSyncStep2(updateEncoder, docData.doc);
                        broadcast(docName, encoding.toUint8Array(updateEncoder), conn);
                    }
                    break;
                }

                case messageAwareness: {
                    const update = decoding.readVarUint8Array(decoder);
                    awarenessProtocol.applyAwarenessUpdate(
                        docData.awareness,
                        update,
                        conn
                    );



                    // Broadcast awareness to other clients
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageAwareness);
                    encoding.writeVarUint8Array(encoder, update);
                    broadcast(docName, encoding.toUint8Array(encoder), conn);
                    break;
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle disconnect
    conn.on('close', () => {
        docData.connections.delete(conn);
        console.log(`👋 Client disconnected from document: ${docName} (${docData.connections.size} remaining)`);

        // Remove awareness state
        awarenessProtocol.removeAwarenessStates(
            docData.awareness,
            [docData.doc.clientID],
            null
        );
    });

    // Handle errors
    conn.on('error', (error) => {
        console.error('WebSocket error:', error);
        docData.connections.delete(conn);
    });
});

// Handle server errors
wss.on('error', (error) => {
    console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Yjs server...');
    wss.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
