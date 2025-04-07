package com.luzhou.big2.model;

import lombok.Data;
import java.util.*;

@Data
public class GameRoom {
    private String id;
    private List<Player> players;
    private GameStatus status;
    private int currentPlayerIndex;
    private List<Card> lastPlayedCards;
    private int lastPlayedByPosition;
    private List<Card> deck;

    public GameRoom(String id) {
        this.id = id;
        this.players = new ArrayList<>();
        this.status = GameStatus.WAITING;
        this.currentPlayerIndex = 0;
        this.lastPlayedCards = new ArrayList<>();
        this.lastPlayedByPosition = -1;
        initializeDeck();
    }

    private void initializeDeck() {
        deck = new ArrayList<>();
        for (Card.Suit suit : Card.Suit.values()) {
            for (Card.Rank rank : Card.Rank.values()) {
                deck.add(new Card(suit, rank));
            }
        }
    }

    public void shuffleAndDeal() {
        Collections.shuffle(deck);
        int cardsPerPlayer = deck.size() / 4;
        
        for (int i = 0; i < players.size(); i++) {
            Player player = players.get(i);
            for (int j = 0; j < cardsPerPlayer; j++) {
                player.addCard(deck.get(i * cardsPerPlayer + j));
            }
        }
    }

    public boolean addPlayer(Player player) {
        if (players.size() >= 4) {
            return false;
        }
        player.setPosition(players.size());
        players.add(player);
        return true;
    }

    public boolean removePlayer(String playerId) {
        return players.removeIf(p -> p.getId().equals(playerId));
    }

    public boolean isRoomFull() {
        return players.size() >= 4;
    }

    public boolean areAllPlayersReady() {
        return players.size() == 4 && players.stream().allMatch(Player::isReady);
    }

    public enum GameStatus {
        WAITING,
        PLAYING,
        FINISHED
    }
} 