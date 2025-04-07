//package com.luzhou.big2.controller;
//
//import com.luzhou.big2.model.*;
//import com.luzhou.big2.service.GameService;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.HashMap;
//import java.util.List;
//import java.util.Map;
//
//@RestController
//@RequestMapping("/api/game")
//public class GameController {
//
//    @Autowired
//    private GameService gameService;
//
//    /**
//     * 获取所有房间的信息（管理员功能）
//     */
//    @GetMapping("/rooms")
//    public ResponseEntity<Map<String, Object>> getAllRooms() {
//        Map<String, Object> response = new HashMap<>();
//        response.put("rooms", gameService.getAllRooms());
//        return ResponseEntity.ok(response);
//    }
//
//    /**
//     * 获取指定房间的信息
//     */
//    @GetMapping("/rooms/{roomId}")
//    public ResponseEntity<?> getRoomInfo(@PathVariable String roomId) {
//        GameRoom room = gameService.getRoom(roomId);
//        if (room == null) {
//            Map<String, String> errorResponse = new HashMap<>();
//            errorResponse.put("error", "房间不存在");
//            return ResponseEntity.badRequest().body(errorResponse);
//        }
//        return ResponseEntity.ok(room);
//    }
//
//    /**
//     * 创建新房间
//     */
//    @PostMapping("/rooms")
//    public ResponseEntity<GameRoom> createRoom() {
//        GameRoom room = gameService.createRoom();
//        return ResponseEntity.ok(room);
//    }
//
//    /**
//     * 加入房间
//     */
//    @PostMapping("/rooms/{roomId}/join")
//    public ResponseEntity<?> joinRoom(@PathVariable String roomId, @RequestBody Player player) {
//        GameRoom room = gameService.joinRoom(roomId, player);
//        if (room == null) {
//            Map<String, String> errorResponse = new HashMap<>();
//            errorResponse.put("error", "无法加入房间");
//            return ResponseEntity.badRequest().body(errorResponse);
//        }
//        return ResponseEntity.ok(room);
//    }
//
//    /**
//     * 离开房间
//     */
//    @PostMapping("/rooms/{roomId}/leave")
//    public ResponseEntity<?> leaveRoom(@PathVariable String roomId, @RequestBody Map<String, String> request) {
//        String playerId = request.get("playerId");
//        boolean success = gameService.leaveRoom(playerId);
//        Map<String, Object> response = new HashMap<>();
//        response.put("success", success);
//        return ResponseEntity.ok(response);
//    }
//
//    /**
//     * 玩家准备
//     */
//    @PostMapping("/rooms/{roomId}/ready")
//    public ResponseEntity<?> playerReady(@PathVariable String roomId, @RequestBody Map<String, String> request) {
//        String playerId = request.get("playerId");
//
//        GameRoom room = gameService.getRoom(roomId);
//        if (room == null) {
//            Map<String, String> errorResponse = new HashMap<>();
//            errorResponse.put("error", "房间不存在");
//            return ResponseEntity.badRequest().body(errorResponse);
//        }
//
//        // 查找玩家
//        Player player = room.getPlayers().stream()
//                .filter(p -> p.getId().equals(playerId))
//                .findFirst()
//                .orElse(null);
//
//        if (player == null) {
//            Map<String, String> errorResponse = new HashMap<>();
//            errorResponse.put("error", "玩家不在房间中");
//            return ResponseEntity.badRequest().body(errorResponse);
//        }
//
//        // 设置玩家准备状态
//        player.setReady(true);
//
//        // 检查是否所有玩家都已准备
//        if (room.areAllPlayersReady()) {
//            gameService.startGame(roomId);
//        }
//
//        return ResponseEntity.ok(room);
//    }
//
//    /**
//     * 获取健康状态
//     */
//    @GetMapping("/health")
//    public ResponseEntity<Map<String, String>> health() {
//        Map<String, String> response = new HashMap<>();
//        response.put("status", "UP");
//        return ResponseEntity.ok(response);
//    }
//}