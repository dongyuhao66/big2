package com.luzhou.big2.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthCheckController {

    @GetMapping("/api/health")
    public Map<String, Object> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "服务器运行正常");
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
    
    @GetMapping("/api/websocket-test")
    public Map<String, Object> websocketInfo() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "WebSocket服务已启用");
        response.put("endpoints", new String[]{"/ws"});
        response.put("supportedProtocols", new String[]{"WebSocket", "SockJS"});
        return response;
    }
} 