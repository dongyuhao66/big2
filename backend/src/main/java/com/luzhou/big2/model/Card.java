package com.luzhou.big2.model;

import lombok.Data;

@Data
public class Card implements Comparable<Card> {
    private Suit suit;
    private Rank rank;

    public Card(Suit suit, Rank rank) {
        this.suit = suit;
        this.rank = rank;
    }

    @Override
    public int compareTo(Card other) {
        if (this.rank.getValue() != other.rank.getValue()) {
            return this.rank.getValue() - other.rank.getValue();
        }
        return this.suit.getValue() - other.suit.getValue();
    }

    public enum Suit {
        SPADES(4), HEARTS(3), CLUBS(2), DIAMONDS(1);

        private final int value;

        Suit(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    public enum Rank {
        TWO(13), ACE(12), KING(11), QUEEN(10), JACK(9),
        TEN(8), NINE(7), EIGHT(6), SEVEN(5), SIX(4),
        FIVE(3), FOUR(2), THREE(1);

        private final int value;

        Rank(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }
} 