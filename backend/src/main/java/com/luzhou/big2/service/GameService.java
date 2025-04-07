package com.luzhou.big2.service;

import com.luzhou.big2.model.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {
    private final Map<String, GameRoom> gameRooms = new ConcurrentHashMap<>();
    private final Map<String, String> playerRoomMap = new ConcurrentHashMap<>();

    public GameRoom createRoom() {
        String roomId = generateRoomId();
        GameRoom room = new GameRoom(roomId);
        gameRooms.put(roomId, room);
        return room;
    }

    /**
     * 生成6位纯数字房间号
     */
    private String generateRoomId() {
        // 生成6位数字的房间ID
        int min = 100000;
        int max = 999999;
        String roomId;
        do {
            roomId = String.valueOf(min + (int)(Math.random() * ((max - min) + 1)));
        } while (gameRooms.containsKey(roomId)); // 确保房间号不重复
        
        return roomId;
    }

    public GameRoom joinRoom(String roomId, Player player) {
        GameRoom room = gameRooms.get(roomId);
        if (room == null || room.isRoomFull()) {
            return null;
        }
        
        if (room.addPlayer(player)) {
            playerRoomMap.put(player.getId(), roomId);
            return room;
        }
        return null;
    }

    public GameRoom matchPlayer(Player player) {
        for (GameRoom room : gameRooms.values()) {
            if (!room.isRoomFull() && room.getStatus() == GameRoom.GameStatus.WAITING) {
                if (room.addPlayer(player)) {
                    playerRoomMap.put(player.getId(), room.getId());
                    return room;
                }
            }
        }
        
        // 如果没有合适的房间，创建新房间
        GameRoom newRoom = createRoom();
        newRoom.addPlayer(player);
        playerRoomMap.put(player.getId(), newRoom.getId());
        return newRoom;
    }

    public boolean leaveRoom(String playerId) {
        String roomId = playerRoomMap.get(playerId);
        if (roomId == null) {
            return false;
        }

        GameRoom room = gameRooms.get(roomId);
        if (room == null) {
            return false;
        }

        boolean removed = room.removePlayer(playerId);
        if (removed) {
            playerRoomMap.remove(playerId);
            if (room.getPlayers().isEmpty()) {
                gameRooms.remove(roomId);
            }
        }
        return removed;
    }

    public GameRoom getRoom(String roomId) {
        return gameRooms.get(roomId);
    }

    public GameRoom getRoomByPlayerId(String playerId) {
        String roomId = playerRoomMap.get(playerId);
        return roomId != null ? gameRooms.get(roomId) : null;
    }

    public void startGame(String roomId) {
        GameRoom room = gameRooms.get(roomId);
        if (room != null && room.areAllPlayersReady()) {
            room.setStatus(GameRoom.GameStatus.PLAYING);
            room.shuffleAndDeal();
        }
    }

    public boolean isValidPlay(List<Card> cards) {
        // TODO: 实现出牌规则验证
        return true;
    }

    public void playCards(String roomId, String playerId, List<Card> cards) {
        GameRoom room = gameRooms.get(roomId);
        if (room == null || room.getStatus() != GameRoom.GameStatus.PLAYING) {
            return;
        }

        Player currentPlayer = room.getPlayers().get(room.getCurrentPlayerIndex());
        if (!currentPlayer.getId().equals(playerId)) {
            return;
        }

        if (isValidPlay(cards)) {
            currentPlayer.removeCards(cards);
            room.setLastPlayedCards(cards);
            room.setLastPlayedByPosition(currentPlayer.getPosition());
            
            // 检查游戏是否结束
            if (currentPlayer.getCardCount() == 0) {
                room.setStatus(GameRoom.GameStatus.FINISHED);
                return;
            }

            // 移动到下一个玩家
            room.setCurrentPlayerIndex((room.getCurrentPlayerIndex() + 1) % 4);
        }
    }
} 