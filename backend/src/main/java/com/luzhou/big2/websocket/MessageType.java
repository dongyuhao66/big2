package com.luzhou.big2.websocket;

public enum MessageType {
    PING("ping"),
    PONG("pong"),
    CREATE_ROOM("createRoom"),
    JOIN_ROOM("joinRoom"),
    LEAVE_ROOM("leaveRoom"),
    READY("ready"),
    PLAY_CARDS("playCards"),
    PASS("pass"),
    GAME_STATE("gameState"),
    PLAYER_READY("playerReady"),
    ERROR("error"),
    ECHO("echo"),
    CONNECTED("connected");

    private final String value;

    MessageType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static MessageType fromValue(String value) {
        for (MessageType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown message type: " + value);
    }
} 