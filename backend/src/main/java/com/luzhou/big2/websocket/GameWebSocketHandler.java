package com.luzhou.big2.websocket;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.luzhou.big2.model.Card;
import com.luzhou.big2.model.GameRoom;
import com.luzhou.big2.model.Player;
import com.luzhou.big2.service.GameService;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(GameWebSocketHandler.class);
    private static final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private static final Map<String, String> sessionPlayerMapping = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Autowired
    private GameService gameService;
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        logger.info("WebSocket连接已建立: {}", sessionId);
        
        // 发送连接成功消息
        sendMessage(session, createMessage(MessageType.CONNECTED.getValue(), "WebSocket连接已建立"));
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        String payload = message.getPayload();
        logger.info("收到消息: {} from {}", payload, sessionId);
        
        try {
            JsonNode jsonNode = objectMapper.readTree(payload);
            String typeStr = jsonNode.path("type").asText();
            MessageType type = MessageType.fromValue(typeStr);
            
            logger.info("处理消息类型: {}", type.getValue());

            switch (type) {
                case PING:
                    sendMessage(session, createMessage(MessageType.PONG.getValue(), "服务器响应"));
                    break;
                case CREATE_ROOM:
                    handleCreateRoom(session, jsonNode);
                    break;
                case JOIN_ROOM:
                    handleJoinRoom(session, jsonNode);
                    break;
                case READY:
                    handlePlayerReady(session, jsonNode);
                    break;
                case LEAVE_ROOM:
                    handleLeaveRoom(session, jsonNode);
                    break;
                case PLAY_CARDS:
                    handlePlayCards(session, jsonNode);
                    break;
                case PASS:
                    handlePass(session, jsonNode);
                    break;
                default:
                    // 临时回显消息
                    sendMessage(session, createMessage(MessageType.ECHO.getValue(), "收到消息: " + type.getValue()));
            }
        } catch (Exception e) {
            logger.error("处理消息失败", e);
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "消息格式错误: " + e.getMessage()));
        }
    }
    
    /**
     * 处理创建房间请求
     */
    private void handleCreateRoom(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String playerName = jsonNode.path("playerName").asText("玩家" + sessionId.substring(0, 4));
        
        logger.info("创建房间请求: 玩家={}", playerName);
        
        // 创建玩家
        Player player = new Player(sessionId, playerName);
        player.setSessionId(sessionId);
        
        // 创建房间
        GameRoom room = gameService.createRoom();
        gameService.joinRoom(room.getId(), player);
        
        // 保存会话和玩家的映射关系
        sessionPlayerMapping.put(sessionId, player.getId());
        
        logger.info("房间创建成功: roomId={}, 玩家={}", room.getId(), playerName);
        
        // 发送gameState消息
        sendGameState(room);
    }
    
    /**
     * 处理加入房间请求
     */
    private void handleJoinRoom(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String roomId = jsonNode.path("roomId").asText();
        String playerName = jsonNode.path("playerName").asText("玩家" + sessionId.substring(0, 4));
        
        logger.info("加入房间请求: roomId={}, 玩家={}", roomId, playerName);
        
        // 检查房间是否存在
        GameRoom room = gameService.getRoom(roomId);
        if (room == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间不存在: " + roomId));
            return;
        }
        
        // 检查房间是否已满
        if (room.isRoomFull()) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间已满"));
            return;
        }
        
        // 创建玩家
        Player player = new Player(sessionId, playerName);
        player.setSessionId(sessionId);
        
        // 加入房间
        boolean joined = gameService.joinRoom(roomId, player) != null;
        if (!joined) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "加入房间失败"));
            return;
        }
        
        // 保存会话和玩家的映射关系
        sessionPlayerMapping.put(sessionId, player.getId());
        
        logger.info("加入房间成功: roomId={}, 玩家={}", roomId, playerName);
        
        // 发送gameState消息
        sendGameState(room);
    }
    
    /**
     * 处理玩家准备请求
     */
    private void handlePlayerReady(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String roomId = jsonNode.path("roomId").asText();
        String playerName = jsonNode.path("playerName").asText();
        
        logger.info("玩家准备请求: roomId={}, 玩家={}", roomId, playerName);
        
        // 检查房间是否存在
        GameRoom room = gameService.getRoom(roomId);
        if (room == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间不存在: " + roomId));
            return;
        }
        
        // 查找玩家
        Player player = room.getPlayers().stream()
                .filter(p -> p.getName().equals(playerName))
                .findFirst()
                .orElse(null);
        
        if (player == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "玩家不在房间中"));
            return;
        }
        
        // 设置玩家准备状态
        player.setReady(true);
        
        logger.info("玩家已准备: roomId={}, 玩家={}", roomId, playerName);
        
        // 发送playerReady消息给所有玩家
        ObjectNode readyNode = objectMapper.createObjectNode();
        readyNode.put("type", MessageType.PLAYER_READY.getValue());
        readyNode.put("roomId", roomId);
        readyNode.put("playerName", playerName);
        readyNode.put("position", player.getPosition());
        readyNode.put("timestamp", System.currentTimeMillis());
        
        broadcastToRoom(room, objectMapper.writeValueAsString(readyNode));
        
        // 检查是否所有玩家都已准备
        if (room.areAllPlayersReady()) {
            gameService.startGame(roomId);
            logger.info("所有玩家已准备，游戏开始: roomId={}", roomId);
        }
        
        // 发送gameState消息
        sendGameState(room);
    }
    
    /**
     * 处理玩家离开房间请求
     */
    private void handleLeaveRoom(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String roomId = jsonNode.path("roomId").asText();
        String playerName = jsonNode.path("playerName").asText();
        
        logger.info("玩家离开房间请求: roomId={}, 玩家={}", roomId, playerName);
        
        // 检查房间是否存在
        GameRoom room = gameService.getRoom(roomId);
        if (room == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间不存在: " + roomId));
            return;
        }
        
        // 移除玩家
        boolean removed = gameService.leaveRoom(sessionId);
        if (!removed) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "离开房间失败"));
            return;
        }
        
        // 移除会话和玩家的映射关系
        sessionPlayerMapping.remove(sessionId);
        
        logger.info("玩家已离开房间: roomId={}, 玩家={}", roomId, playerName);
        
        // 如果房间仍然存在（未被删除），则发送gameState消息
        room = gameService.getRoom(roomId);
        if (room != null) {
            sendGameState(room);
        }
        
        // 发送leaveRoom确认消息给玩家
        ObjectNode leaveNode = objectMapper.createObjectNode();
        leaveNode.put("type", MessageType.LEAVE_ROOM.getValue());
        leaveNode.put("roomId", roomId);
        leaveNode.put("playerName", playerName);
        leaveNode.put("timestamp", System.currentTimeMillis());
        
        sendMessage(session, objectMapper.writeValueAsString(leaveNode));
    }
    
    /**
     * 发送游戏状态消息给房间内所有玩家
     */
    private void sendGameState(GameRoom room) throws IOException {
        ObjectNode stateNode = objectMapper.createObjectNode();
        stateNode.put("type", MessageType.GAME_STATE.getValue());
        stateNode.put("roomId", room.getId());
        stateNode.put("status", room.getStatus().name());
        stateNode.put("currentPosition", room.getCurrentPlayerIndex());
        stateNode.put("lastPlayedByPosition", room.getLastPlayedByPosition());
        
        // 添加玩家信息
        ArrayNode playersArray = stateNode.putArray("players");
        for (Player player : room.getPlayers()) {
            ObjectNode playerNode = objectMapper.createObjectNode();
            playerNode.put("id", player.getId());
            playerNode.put("name", player.getName());
            playerNode.put("position", player.getPosition());
            playerNode.put("isReady", player.isReady());
            playerNode.put("cardCount", player.getCardCount());
            playersArray.add(playerNode);
        }
        
        // 添加上一次出牌信息
        if (room.getLastPlayedCards() != null && !room.getLastPlayedCards().isEmpty()) {
            ArrayNode lastPlayedArray = stateNode.putArray("lastPlayedCards");
            room.getLastPlayedCards().forEach(card -> {
                ObjectNode cardNode = objectMapper.createObjectNode();
                cardNode.put("suit", card.getSuit().name());
                cardNode.put("rank", card.getRank().name());
                lastPlayedArray.add(cardNode);
            });
        }
        
        String gameStateMessage = objectMapper.writeValueAsString(stateNode);
        broadcastToRoom(room, gameStateMessage);
        
        // 发送玩家手牌信息（只发给各自玩家）
        for (Player player : room.getPlayers()) {
            WebSocketSession playerSession = sessions.get(player.getSessionId());
            if (playerSession != null && playerSession.isOpen()) {
                ObjectNode playerStateNode = (ObjectNode) objectMapper.readTree(gameStateMessage);
                
                // 添加玩家手牌
                ArrayNode myCardsArray = playerStateNode.putArray("myCards");
                player.getCards().forEach(card -> {
                    ObjectNode cardNode = objectMapper.createObjectNode();
                    cardNode.put("suit", card.getSuit().name());
                    cardNode.put("rank", card.getRank().name());
                    cardNode.put("selected", false);
                    myCardsArray.add(cardNode);
                });
                
                // 设置是否是玩家的回合
                playerStateNode.put("isMyTurn", room.getCurrentPlayerIndex() == player.getPosition());
                playerStateNode.put("myPosition", player.getPosition());
                
                sendMessage(playerSession, objectMapper.writeValueAsString(playerStateNode));
            }
        }
    }
    
    /**
     * 广播消息给房间内所有玩家
     */
    private void broadcastToRoom(GameRoom room, String message) {
        room.getPlayers().forEach(player -> {
            WebSocketSession playerSession = sessions.get(player.getSessionId());
            if (playerSession != null && playerSession.isOpen()) {
                try {
                    sendMessage(playerSession, message);
                } catch (Exception e) {
                    logger.error("发送消息给玩家失败: {}", player.getName(), e);
                }
            }
        });
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("WebSocket传输错误", exception);
        String sessionId = session.getId();
        sessions.remove(sessionId);
        
        // 处理玩家断开连接
        String playerId = sessionPlayerMapping.get(sessionId);
        if (playerId != null) {
            gameService.leaveRoom(playerId);
            sessionPlayerMapping.remove(sessionId);
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        logger.info("WebSocket连接已关闭: {} 状态: {}", sessionId, status);
        sessions.remove(sessionId);
        
        // 处理玩家断开连接
        String playerId = sessionPlayerMapping.get(sessionId);
        if (playerId != null) {
            GameRoom room = gameService.getRoomByPlayerId(playerId);
            if (room != null) {
                logger.info("玩家断开连接，从房间移除: roomId={}, 玩家ID={}", room.getId(), playerId);
                gameService.leaveRoom(playerId);
                sessionPlayerMapping.remove(sessionId);
                
                // 更新房间状态
                if (gameService.getRoom(room.getId()) != null) {
                    try {
                        sendGameState(room);
                    } catch (IOException e) {
                        logger.error("发送游戏状态失败", e);
                    }
                }
            }
        }
    }
    
    /**
     * 发送消息给指定会话
     */
    public void sendMessage(WebSocketSession session, String message) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(message));
            } catch (IOException e) {
                logger.error("发送消息失败", e);
            }
        }
    }
    
    /**
     * 发送消息给所有会话
     */
    public void broadcastMessage(String message) {
        sessions.values().forEach(session -> {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(message));
                }
            } catch (IOException e) {
                logger.error("广播消息失败", e);
            }
        });
    }
    
    /**
     * 创建消息JSON
     */
    private String createMessage(String type, String content) throws JsonProcessingException {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", type);
        node.put("message", content);
        node.put("timestamp", System.currentTimeMillis());
        return objectMapper.writeValueAsString(node);
    }
    
    /**
     * 处理玩家出牌请求
     */
    private void handlePlayCards(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String roomId = jsonNode.path("roomId").asText();
        String playerName = jsonNode.path("playerName").asText();
        
        logger.info("玩家出牌请求: roomId={}, 玩家={}", roomId, playerName);
        
        // 检查房间是否存在
        GameRoom room = gameService.getRoom(roomId);
        if (room == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间不存在: " + roomId));
            return;
        }
        
        // 检查游戏状态
        if (room.getStatus() != GameRoom.GameStatus.PLAYING) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "游戏未开始"));
            return;
        }
        
        // 查找玩家
        Player player = room.getPlayers().stream()
                .filter(p -> p.getName().equals(playerName))
                .findFirst()
                .orElse(null);
        
        if (player == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "玩家不在房间中"));
            return;
        }
        
        // 检查是否是当前玩家的回合
        if (room.getCurrentPlayerIndex() != player.getPosition()) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "不是你的回合"));
            return;
        }
        
        // 解析出牌
        List<Card> cardsToPlay = new ArrayList<>();
        JsonNode cardsNode = jsonNode.path("cards");
        if (cardsNode.isArray()) {
            for (JsonNode cardNode : cardsNode) {
                String suit = cardNode.path("suit").asText();
                String rank = cardNode.path("rank").asText();
                try {
                    Card.Suit cardSuit = Card.Suit.valueOf(suit);
                    Card.Rank cardRank = Card.Rank.valueOf(rank);
                    cardsToPlay.add(new Card(cardSuit, cardRank));
                } catch (IllegalArgumentException e) {
                    sendMessage(session, createMessage(MessageType.ERROR.getValue(), "无效的牌: " + suit + " " + rank));
                    return;
                }
            }
        }
        
        // 检查玩家是否有这些牌
        if (!player.getCards().containsAll(cardsToPlay)) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "你没有这些牌"));
            return;
        }
        
        // 验证出牌是否合法
        if (!gameService.isValidPlay(cardsToPlay)) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "出牌不合法"));
            return;
        }
        
        // 执行出牌
        gameService.playCards(roomId, player.getId(), cardsToPlay);
        
        // 发送gameState消息
        sendGameState(room);
    }
    
    /**
     * 处理玩家过牌请求
     */
    private void handlePass(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String roomId = jsonNode.path("roomId").asText();
        String playerName = jsonNode.path("playerName").asText();
        
        logger.info("玩家过牌请求: roomId={}, 玩家={}", roomId, playerName);
        
        // 检查房间是否存在
        GameRoom room = gameService.getRoom(roomId);
        if (room == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "房间不存在: " + roomId));
            return;
        }
        
        // 检查游戏状态
        if (room.getStatus() != GameRoom.GameStatus.PLAYING) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "游戏未开始"));
            return;
        }
        
        // 查找玩家
        Player player = room.getPlayers().stream()
                .filter(p -> p.getName().equals(playerName))
                .findFirst()
                .orElse(null);
        
        if (player == null) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "玩家不在房间中"));
            return;
        }
        
        // 检查是否是当前玩家的回合
        if (room.getCurrentPlayerIndex() != player.getPosition()) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "不是你的回合"));
            return;
        }
        
        // 检查是否可以过牌（不是第一个出牌的玩家）
        if (room.getLastPlayedByPosition() == -1) {
            sendMessage(session, createMessage(MessageType.ERROR.getValue(), "第一个出牌的玩家不能过牌"));
            return;
        }
        
        // 移动到下一个玩家
        room.setCurrentPlayerIndex((room.getCurrentPlayerIndex() + 1) % 4);
        
        // 发送gameState消息
        sendGameState(room);
    }
} 