package com.luzhou.big2.model;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class Player {
    private String id;
    private String name;
    private String sessionId;
    private List<Card> cards;
    private boolean isReady;
    private int position;

    public Player(String id, String name) {
        this.id = id;
        this.name = name;
        this.cards = new ArrayList<>();
        this.isReady = false;
    }

    public void addCard(Card card) {
        cards.add(card);
    }

    public void removeCards(List<Card> cardsToRemove) {
        cards.removeAll(cardsToRemove);
    }

    public int getCardCount() {
        return cards.size();
    }
} 