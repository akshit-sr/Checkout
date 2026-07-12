package com.example.checkout.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Broadcasts product changes to connected storefront clients over
 * Server-Sent Events, so newly added products / stock changes appear
 * instantly without polling.
 */
@Service
public class ProductStreamService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** Registers a new client. The emitter never times out on its own. */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L); // 0 = no timeout
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            // Initial handshake so the client knows the stream is live.
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    /**
     * Notifies every connected client that the catalog changed. Fully defensive:
     * a broken/stale connection is dropped and never allowed to propagate an
     * exception back to the caller (which would 500 an unrelated request).
     */
    public void broadcast(String action) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("products-changed").data(action));
            } catch (Exception e) {
                emitters.remove(emitter);
                try {
                    emitter.completeWithError(e);
                } catch (Exception ignored) {
                    // emitter may already be complete; nothing more to do
                }
            }
        }
    }
}
