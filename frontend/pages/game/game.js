// 游戏牌桌页面逻辑
const app = getApp();

Page({
  data: {
    // 游戏状态
    roomId: '',
    status: 'WAITING', // WAITING, PLAYING, FINISHED
    gameStatusText: '等待开始',
    
    // 玩家信息
    players: [],
    myPosition: 0,
    myCards: [],
    selectedCards: [],
    
    // 游戏回合信息
    currentPlayerIndex: -1,
    isMyTurn: false,
    lastPlayedCards: [],
    lastPlayedByPosition: -1,
    
    // WebSocket连接状态
    socketConnected: false,
    reconnecting: false
  },

  onLoad: function (options) {
    console.log('游戏页面加载', options);
    
    // 从上个页面获取房间信息
    if (options.roomId) {
      this.setData({
        roomId: options.roomId
      });
    }
    
    // 延迟设置WebSocket，让页面先渲染
    setTimeout(() => {
      this.setupWebSocket();
    }, 100);
  },
  
  onShow: function () {
    // 如果已断开连接则重连
    if (!this.data.socketConnected && !this.data.reconnecting) {
      setTimeout(() => {
        this.setupWebSocket();
      }, 100);
    }
  },
  
  onUnload: function () {
    // 页面卸载时关闭WebSocket连接
    this.closeSocket();
  },
  
  // 初始化WebSocket连接
  setupWebSocket: function () {
    const that = this;
    
    // 如果已经在重连中，直接返回
    if (that.data.reconnecting) {
      return;
    }
    
    that.setData({ reconnecting: true });
    
    console.log('正在连接WebSocket...');
    
    // 显示加载提示
    wx.showLoading({
      title: '连接中...',
      mask: true
    });
    
    // 已有全局连接则直接使用
    if (app.globalData.socketTask && app.globalData.socketConnected) {
      console.log('使用现有WebSocket连接');
      that.setData({
        socketConnected: true,
        reconnecting: false
      });
      wx.hideLoading();
      return;
    }
    
    // 清理之前的连接
    if (app.globalData.socketTask) {
      try {
        app.globalData.socketTask.close();
      } catch (e) {
        console.log('关闭旧连接失败:', e);
      }
    }
    
    // 创建新连接
    const socketTask = wx.connectSocket({
      url: app.globalData.serverUrl,
      success: function () {
        console.log('WebSocket连接请求已发送');
      },
      fail: function (err) {
        console.error('WebSocket连接失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '连接服务器失败',
          icon: 'none'
        });
        that.setData({ reconnecting: false });
      }
    });
    
    app.globalData.socketTask = socketTask;
    
    // 监听WebSocket连接打开事件
    socketTask.onOpen(function () {
      console.log('WebSocket连接已打开');
      app.globalData.socketConnected = true;
      that.setData({
        socketConnected: true,
        reconnecting: false
      });
      
      // 延迟发送ping保持连接
      setTimeout(() => {
        that.startHeartbeat();
      }, 1000);
      
      // 如果有房间ID，延迟加入房间
      if (that.data.roomId) {
        setTimeout(() => {
          that.joinRoom();
        }, 500);
      }
    });
    
    // 监听WebSocket接收到服务器的消息事件
    socketTask.onMessage(function (res) {
      that.handleWebSocketMessage(res);
    });
    
    // 监听WebSocket错误事件
    socketTask.onError(function (err) {
      console.error('WebSocket错误', err);
      app.globalData.socketConnected = false;
      that.setData({
        socketConnected: false,
        reconnecting: false
      });
      
      wx.showToast({
        title: 'WebSocket错误',
        icon: 'none'
      });
    });
    
    // 监听WebSocket连接关闭事件
    socketTask.onClose(function () {
      console.log('WebSocket连接已关闭');
      app.globalData.socketConnected = false;
      that.setData({
        socketConnected: false,
        reconnecting: false
      });
      
      // 自动重连
      if (!that.data.reconnecting) {
        setTimeout(function () {
          that.setupWebSocket();
        }, 3000);
      }
    });
  },
  
  // 心跳包，保持连接
  startHeartbeat: function () {
    const that = this;
    
    // 清除之前的心跳定时器
    if (that.heartbeatInterval) {
      clearInterval(that.heartbeatInterval);
      that.heartbeatInterval = null;
    }
    
    // 设置定时发送心跳包
    that.heartbeatInterval = setInterval(function () {
      if (that.data.socketConnected) {
        that.sendMessage({
          type: 'ping',
          timestamp: new Date().getTime()
        });
      } else {
        clearInterval(that.heartbeatInterval);
        that.heartbeatInterval = null;
      }
    }, 30000); // 每30秒发送一次
  },
  
  // 关闭WebSocket连接
  closeSocket: function () {
    // 清除心跳定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // 关闭WebSocket连接
    if (app.globalData.socketTask) {
      try {
        app.globalData.socketTask.close();
      } catch (e) {
        console.log('关闭WebSocket连接失败:', e);
      }
      app.globalData.socketTask = null;
    }
    
    app.globalData.socketConnected = false;
    this.setData({
      socketConnected: false,
      reconnecting: false
    });
  },
  
  // 发送WebSocket消息
  sendMessage: function (data) {
    if (!app.globalData.socketTask || !app.globalData.socketConnected) {
      console.error('WebSocket未连接，无法发送消息');
      wx.showToast({
        title: '连接已断开',
        icon: 'none'
      });
      return;
    }
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    console.log('发送消息:', message);
    
    try {
      app.globalData.socketTask.send({
        data: message,
        success: function () {
          console.log('消息发送成功');
        },
        fail: function (err) {
          console.error('消息发送失败', err);
        }
      });
    } catch (err) {
      console.error('发送消息出错', err);
    }
  },
  
  // 处理WebSocket消息
  handleWebSocketMessage: function (res) {
    try {
      const message = JSON.parse(res.data);
      console.log('收到消息:', message);
      
      // 收到任何消息都隐藏加载提示
      wx.hideLoading();
      
      // 清除加入房间超时
      if (this.joinRoomTimeout) {
        clearTimeout(this.joinRoomTimeout);
        this.joinRoomTimeout = null;
      }
      
      if (message.type === 'pong') {
        console.log('收到pong响应');
        return;
      }
      
      if (message.type === 'gameState') {
        console.log('收到游戏状态消息:', message);
        
        // 如果游戏状态是PLAYING且当前页面状态不是PLAYING，说明是刚进入游戏
        if (message.status === 'PLAYING' && this.data.status !== 'PLAYING') {
          console.log('游戏开始，更新游戏状态');
          this.handleGameState(message);
        } else if (message.status === 'PLAYING') {
          // 游戏进行中的状态更新
          this.handleGameState(message);
        } else if (message.status === 'WAITING') {
          // 游戏等待状态，可能是重新准备
          this.handleGameState(message);
        }
      } else if (message.type === 'error') {
        wx.showToast({
          title: message.message || '发生错误',
          icon: 'none'
        });
      } else if (message.type === 'joinRoomSuccess') {
        console.log('成功加入房间');
        
        // 不再请求游戏状态，服务器会自动发送gameState
        wx.showToast({
          title: '已加入房间',
          icon: 'success'
        });
      }
    } catch (err) {
      console.error('处理消息出错', err);
      wx.hideLoading();
    }
  },
  
  // 处理游戏状态更新
  handleGameState: function (data) {
    console.log('处理游戏状态更新:', data);
    
    // 游戏状态更新
    let gameStatusText = '等待开始';
    if (data.status === 'PLAYING') {
      gameStatusText = '游戏进行中';
    } else if (data.status === 'FINISHED') {
      gameStatusText = '游戏结束';
    }
    
    // 处理牌的显示转换
    let myCards = [];
    if (data.myCards && Array.isArray(data.myCards)) {
      myCards = data.myCards.map(card => {
        return {
          ...card,
          rankDisplay: this.getRankDisplay(card.rank),
          suitIcon: this.getSuitIcon(card.suit),
          selected: false
        };
      });
      
      // 按照牌的大小排序
      myCards.sort((a, b) => this.compareCards(a, b));
    }
    
    // 处理上一次出牌显示转换
    let lastPlayedCards = [];
    if (data.lastPlayedCards && Array.isArray(data.lastPlayedCards)) {
      lastPlayedCards = data.lastPlayedCards.map(card => {
        return {
          ...card,
          rankDisplay: this.getRankDisplay(card.rank),
          suitIcon: this.getSuitIcon(card.suit)
        };
      });
    }
    
    // 确保isMyTurn是布尔值
    const isMyTurn = data.isMyTurn === true;
    
    // 确保myPosition是有效的数字
    const myPosition = typeof data.myPosition === 'number' ? data.myPosition : 0;
    
    // 确保players是数组
    const players = data.players && Array.isArray(data.players) ? data.players : [];
    
    // 确保currentPlayerIndex是数字
    const currentPlayerIndex = typeof data.currentPosition === 'number' ? data.currentPosition : -1;
    
    // 确保lastPlayedByPosition是数字
    const lastPlayedByPosition = typeof data.lastPlayedByPosition === 'number' ? data.lastPlayedByPosition : -1;
    
    // 更新数据，确保每个字段都有有效值
    this.setData({
      roomId: data.roomId || this.data.roomId,
      status: data.status || 'WAITING',
      gameStatusText: gameStatusText,
      players: players,
      currentPlayerIndex: currentPlayerIndex,
      isMyTurn: isMyTurn,
      myPosition: myPosition,
      myCards: myCards,
      selectedCards: [],
      lastPlayedCards: lastPlayedCards,
      lastPlayedByPosition: lastPlayedByPosition
    });
    
    console.log('更新后的游戏状态:', this.data);
    
    // 游戏开始时，显示提示
    if (data.status === 'PLAYING' && isMyTurn) {
      wx.showToast({
        title: '轮到你出牌了',
        icon: 'none'
      });
    }
  },
  
  // 加入房间
  joinRoom: function () {
    // 如果游戏已经开始，不再发送加入房间消息
    if (this.data.status === 'PLAYING') {
      console.log('游戏已开始，不再发送加入房间消息');
      
      // 游戏已开始，仍然加入房间，服务器会自动发送当前游戏状态
      this.sendMessage({
        type: 'joinRoom',
        roomId: this.data.roomId,
        playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : ('玩家' + Math.floor(Math.random() * 1000)),
        timestamp: new Date().getTime()
      });
      
      return;
    }
    
    console.log('尝试加入房间:', this.data.roomId);
    
    wx.showLoading({
      title: '加入房间中...',
      mask: true
    });
    
    // 使用玩家昵称或随机生成玩家名称
    const playerName = app.globalData.userInfo ? app.globalData.userInfo.nickName : ('玩家' + Math.floor(Math.random() * 1000));
    
    // 保存到app全局变量，方便后续使用
    app.globalData.playerName = playerName;
    
    console.log('当前玩家名称:', playerName);
    
    this.sendMessage({
      type: 'joinRoom',
      roomId: this.data.roomId,
      playerName: playerName,
      timestamp: new Date().getTime()
    });
    
    // 设置加入房间超时
    this.joinRoomTimeout = setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '加入房间超时',
        icon: 'none'
      });
    }, 5000);
  },
  
  // 离开房间
  leaveRoom: function () {
    console.log('离开房间:', this.data.roomId);
    
    wx.showModal({
      title: '离开房间',
      content: '确定要离开当前游戏房间吗？',
      success: (res) => {
        if (res.confirm) {
          this.sendMessage({
            type: 'leaveRoom',
            roomId: this.data.roomId,
            playerName: this.getPlayerByPosition(this.data.myPosition).name,
            timestamp: new Date().getTime()
          });
          
          // 返回到上一页
          wx.navigateBack();
        }
      }
    });
  },
  
  // 选择卡牌
  selectCard: function (e) {
    if (!this.data.isMyTurn) {
      return;
    }
    
    const index = e.currentTarget.dataset.index;
    const myCards = this.data.myCards;
    const selectedCards = this.data.selectedCards;
    
    // 切换选中状态
    myCards[index].selected = !myCards[index].selected;
    
    // 更新选中的卡牌列表
    if (myCards[index].selected) {
      selectedCards.push(myCards[index]);
    } else {
      const cardIndex = selectedCards.findIndex(card => 
        card.suit === myCards[index].suit && card.rank === myCards[index].rank
      );
      if (cardIndex !== -1) {
        selectedCards.splice(cardIndex, 1);
      }
    }
    
    this.setData({
      myCards: myCards,
      selectedCards: selectedCards
    });
  },
  
  // 出牌
  playCards: function () {
    if (!this.data.isMyTurn || this.data.selectedCards.length === 0) {
      return;
    }
    
    console.log('尝试出牌:', this.data.selectedCards);
    
    this.sendMessage({
      type: 'playCards',
      roomId: this.data.roomId,
      playerName: this.getPlayerByPosition(this.data.myPosition).name,
      cards: this.data.selectedCards,
      timestamp: new Date().getTime()
    });
  },
  
  // 过牌
  pass: function () {
    if (!this.data.isMyTurn || this.data.lastPlayedByPosition === -1) {
      return;
    }
    
    console.log('尝试过牌');
    
    this.sendMessage({
      type: 'pass',
      roomId: this.data.roomId,
      playerName: this.getPlayerByPosition(this.data.myPosition).name,
      timestamp: new Date().getTime()
    });
  },
  
  // 准备新游戏
  readyForNewGame: function () {
    console.log('准备开始新游戏');
    
    this.sendMessage({
      type: 'ready',
      roomId: this.data.roomId,
      playerName: this.getPlayerByPosition(this.data.myPosition).name,
      timestamp: new Date().getTime()
    });
  },
  
  // 辅助方法：根据位置获取玩家
  getPlayerByPosition: function (position) {
    if (!this.data.players || !Array.isArray(this.data.players) || this.data.players.length === 0) {
      console.warn('玩家列表为空或无效', this.data.players);
      return { name: app.globalData.playerName || '未知玩家' };
    }
    
    const player = this.data.players.find(player => player.position === position);
    if (!player) {
      console.warn(`未找到位置为 ${position} 的玩家`);
      return { name: app.globalData.playerName || '未知玩家' };
    }
    
    return player;
  },
  
  // 辅助方法：根据位置获取玩家名称
  getPlayerNameByPosition: function (position) {
    const player = this.getPlayerByPosition(position);
    return player.name || '未知玩家';
  },
  
  // 辅助方法：获取牌面的显示值
  getRankDisplay: function (rank) {
    const rankMap = {
      'THREE': '3',
      'FOUR': '4',
      'FIVE': '5',
      'SIX': '6',
      'SEVEN': '7',
      'EIGHT': '8',
      'NINE': '9',
      'TEN': '10',
      'JACK': 'J',
      'QUEEN': 'Q',
      'KING': 'K',
      'ACE': 'A',
      'TWO': '2'
    };
    return rankMap[rank] || rank;
  },
  
  // 辅助方法：获取花色图标
  getSuitIcon: function (suit) {
    const suitMap = {
      'HEARTS': '♥',
      'DIAMONDS': '♦',
      'CLUBS': '♣',
      'SPADES': '♠'
    };
    return suitMap[suit] || suit;
  },
  
  // 辅助方法：比较两张牌的大小，用于排序
  compareCards: function (a, b) {
    const rankOrder = {
      'THREE': 0,
      'FOUR': 1,
      'FIVE': 2,
      'SIX': 3,
      'SEVEN': 4,
      'EIGHT': 5,
      'NINE': 6,
      'TEN': 7,
      'JACK': 8,
      'QUEEN': 9,
      'KING': 10,
      'ACE': 11,
      'TWO': 12
    };
    
    const suitOrder = {
      'CLUBS': 0,
      'DIAMONDS': 1,
      'HEARTS': 2,
      'SPADES': 3
    };
    
    // 首先按牌面大小排序
    if (rankOrder[a.rank] !== rankOrder[b.rank]) {
      return rankOrder[a.rank] - rankOrder[b.rank];
    }
    
    // 相同牌面按花色排序
    return suitOrder[a.suit] - suitOrder[b.suit];
  }
}); 