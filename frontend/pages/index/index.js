const app = getApp()

Page({
  data: {
    inRoom: false,
    showJoinInput: false,
    roomId: '',
    players: [],
    gameStarted: false,
    isReady: false,
    currentPosition: -1,
    isMyTurn: false,
    myCards: [],
    lastPlayedCards: [],
    inputRoomId: '',
    readyCount: 0,
    animationData: {},
    soundEnabled: true,
    copyTooltip: '复制',
    myPosition: 0,
  },

  onLoad: function () {
    // 播放背景音乐
    // this.bgm = wx.createInnerAudioContext()
    // this.bgm.src = '/sounds/bgm.mp3'
    // this.bgm.loop = true
    
    // 初始化音效
    // this.dealSound = wx.createInnerAudioContext()
    // this.dealSound.src = '/sounds/deal.mp3'
    
    // this.playCardSound = wx.createInnerAudioContext()
    // this.playCardSound.src = '/sounds/play_card.mp3'
    
    // this.buttonSound = wx.createInnerAudioContext()
    // this.buttonSound.src = '/sounds/button.mp3'
    
    // if (this.data.soundEnabled) {
    //   this.bgm.play()
    // }
    
    this.initWebSocket()
    
    // 创建动画实例
    this.animation = wx.createAnimation({
      duration: 500,
      timingFunction: 'ease',
    })
  },
  
  onShow: function() {
    if (this.data.soundEnabled && this.bgm) {
      this.bgm.play()
    }
  },
  
  onHide: function() {
    if (this.bgm) {
      this.bgm.pause()
    }
  },
  
  onUnload: function() {
    if (this.bgm) {
      this.bgm.destroy()
    }
    if (this.dealSound) {
      this.dealSound.destroy()
    }
    if (this.playCardSound) {
      this.playCardSound.destroy()
    }
    if (this.buttonSound) {
      this.buttonSound.destroy()
    }
  },

  initWebSocket: function () {
    // 先清理原有的事件监听
    try {
      wx.closeSocket();
    } catch (e) {
      console.log('没有已存在的WebSocket连接');
    }
    
    // 移除所有事件监听
    wx.onSocketOpen(null);
    wx.onSocketError(null);
    wx.onSocketMessage(null);
    wx.onSocketClose(null);
    
    // 延迟一下确保之前的连接关闭
    setTimeout(() => {
      this._connectWebSocket();
    }, 300);
  },
  
  _connectWebSocket: function() {
    // 显示加载提示
    wx.showLoading({
      title: '连接中...',
    });
    
    // 连接WebSocket
    wx.connectSocket({
      url: app.globalData.serverUrl,
      header: {
        'content-type': 'application/json'
      },
      fail: (err) => {
        console.error('WebSocket连接失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '连接服务器失败',
          icon: 'none',
          duration: 2000
        });
      },
      success: () => {
        console.log('WebSocket连接请求已发送');
      },
      complete: () => {
        // 注册事件监听
        this._registerSocketEvents();
      }
    });
  },
  
  _registerSocketEvents: function() {
    // 打开连接事件
    wx.onSocketOpen((res) => {
      console.log('WebSocket连接已打开', res);
      wx.hideLoading();
      
      // 连接成功后，设置websocket已连接状态
      app.globalData.websocketConnected = true;
      
      // 连接成功后发送测试消息
      setTimeout(() => {
        this.sendMessage({
          type: 'ping',
          timestamp: Date.now()
        });
      }, 300);
    });
    
    // 接收消息事件
    wx.onSocketMessage((res) => {
      console.log('收到消息:', res.data);
      try {
        // 检查消息是否为空或非JSON格式
        if (!res.data || res.data === 'undefined' || res.data === 'null') {
          console.warn('收到无效消息:', res.data);
          return;
        }
        
        // 尝试解析JSON
        const data = JSON.parse(res.data);
        this.handleWebSocketMessage(data);
      } catch (e) {
        console.error('解析消息失败:', e, res.data);
        // 对于非JSON消息的处理
        if (typeof res.data === 'string') {
          console.log('收到非JSON格式消息:', res.data);
          // 可以在这里处理纯文本消息
        }
      }
    });
    
    // 连接关闭事件
    wx.onSocketClose((res) => {
      console.log('WebSocket连接已关闭', res);
      app.globalData.websocketConnected = false;
      
      // 避免重复显示提示
      if (res.code !== 1000) { // 1000是正常关闭
        wx.showToast({
          title: '连接已断开',
          icon: 'none',
          duration: 2000
        });
      }
    });
    
    // 错误事件
    wx.onSocketError((err) => {
      console.error('WebSocket错误:', err);
      app.globalData.websocketConnected = false;
      wx.hideLoading();
      
      wx.showToast({
        title: '连接错误，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  handleWebSocketMessage: function (message) {
    console.log('收到WebSocket消息:', message);
    
    try {
      // 如果message已经是对象(已解析过的JSON)，直接使用
      const data = typeof message === 'object' && message !== null ? 
                  message : JSON.parse(message.data || '{}');
      
      console.log('处理消息类型:', data.type);
      
      // 清除可能存在的加入房间超时
      if (this.joinRoomTimeout) {
        clearTimeout(this.joinRoomTimeout);
        this.joinRoomTimeout = null;
        wx.hideLoading();
      }

      if (data.type === 'gameState') {
        console.log('Game state update received:', data);
        
        // 计算准备的玩家数
        const readyCount = data.players ? data.players.filter(p => p.isReady).length : 0;
        
        // 如果游戏刚刚开始，播放发牌声音
        if (!this.data.gameStarted && data.status === 'PLAYING' && this.data.soundEnabled) {
          if (this.dealSound) {
            this.dealSound.play();
          }
        }
        
        // 更新房间信息
        if (data.roomId) {
          this.setData({
            inRoom: true,
            roomId: data.roomId,
            showJoinInput: false // 隐藏加入房间输入框
          });
        }
        
        // 获取当前玩家名称
        const currentPlayerName = app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家';
        
        // 检查本地"已准备"状态是否与服务器同步
        if (data.players) {
          const player = data.players.find(p => p.name === currentPlayerName);
          if (player) {
            // 如果服务器显示玩家已准备，确保本地状态也是已准备
            if (player.isReady && !this.data.isReady) {
              this.setData({
                isReady: true
              });
            } 
            // 如果服务器显示玩家未准备，确保本地状态也是未准备
            else if (!player.isReady && this.data.isReady) {
              this.setData({
                isReady: false
              });
            }
          }
        }
        
        // 更新界面状态
        this.setData({
          players: data.players || [],
          gameStarted: data.status === 'PLAYING',
          currentPosition: data.currentPosition || -1,
          isMyTurn: data.currentPosition === this.data.myPosition,
          myCards: data.myCards || [],
          lastPlayedCards: data.lastPlayedCards || [],
          readyCount: readyCount,
          myPosition: data.myPosition || 0
        });
        
        console.log('界面状态已更新:', this.data);
        
        // 如果是我的回合，添加提示动画
        if (data.currentPosition === this.data.myPosition && data.status === 'PLAYING') {
          this.showMyTurnAnimation();
        }
        
        // 显示提示消息
        wx.showToast({
          title: data.status === 'WAITING' ? '已进入房间' : '游戏开始',
          icon: 'success',
          duration: 1500
        });
        
        // 游戏开始时，跳转到游戏页面
        if (data.status === 'PLAYING') {
          console.log('游戏开始，跳转到游戏页面');
          
          // 先关闭所有定时器和连接
          if (this.joinRoomTimeout) {
            clearTimeout(this.joinRoomTimeout);
            this.joinRoomTimeout = null;
          }
          
          // 关闭WebSocket连接
          try {
            wx.closeSocket();
          } catch (e) {
            console.log('关闭WebSocket连接失败:', e);
          }
          
          // 隐藏加载提示
          wx.hideLoading();
          
          // 延迟跳转，确保资源清理完成
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/game/game?roomId=${data.roomId}`,
              success: function() {
                console.log('成功跳转到游戏页面');
              },
              fail: function(error) {
                console.error('跳转游戏页面失败', error);
                wx.showToast({
                  title: '无法启动游戏界面',
                  icon: 'none'
                });
              }
            });
          }, 500);
        }
      } 
      else if (data.type === 'playerReady') {
        // 处理其他玩家准备状态更新
        console.log('收到玩家准备状态更新:', data);
        
        if (data.playerName && data.roomId === this.data.roomId) {
          // 查找玩家并更新其准备状态
          const playerIndex = this.data.players.findIndex(p => p.name === data.playerName);
          
          if (playerIndex !== -1) {
            const updatedPlayers = [...this.data.players];
            updatedPlayers[playerIndex].isReady = true;
            
            // 计算准备的玩家数量
            const readyCount = updatedPlayers.filter(p => p.isReady).length;
            
            this.setData({
              players: updatedPlayers,
              readyCount: readyCount
            });
            
            // 如果是当前玩家，确保本地状态同步
            if (data.playerName === (app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家')) {
              this.setData({
                isReady: true
              });
            }
            
            console.log('玩家准备状态已更新:', this.data.players);
          }
        }
      }
      else if (data.type === 'error') {
        console.error('Error message from server:', data.message);
        wx.showToast({
          title: data.message || '操作失败',
          icon: 'none'
        });
      } else if (data.type === 'connected') {
        console.log('WebSocket连接成功:', data);
      } else if (data.type === 'pong') {
        console.log('收到服务器响应:', data);
      } else if (data.type === 'echo') {
        console.log('收到回显消息:', data);
      } else {
        console.log('Other message type received:', data.type);
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  },

  showMyTurnAnimation: function() {
    this.animation.scale(1.05).step()
    this.animation.scale(1).step()
    
    this.setData({
      animationData: this.animation.export()
    })
  },

  playButtonSound: function() {
    if (this.data.soundEnabled && this.buttonSound) {
      this.buttonSound.play()
    }
  },

  sendMessage: function (type, data = {}) {
    // 兼容两种调用方式：
    // 1. sendMessage('ping', { timestamp: Date.now() })
    // 2. sendMessage({ type: 'ping', timestamp: Date.now() })
    let message;
    
    if (typeof type === 'string') {
      message = {
        type: type,
        ...data
      };
    } else if (typeof type === 'object') {
      message = type;
    } else {
      console.error('无效的消息格式');
      return;
    }
    
    console.log('准备发送消息:', message);
    
    // 确保消息有type字段
    if (!message.type) {
      console.error('消息缺少type字段:', message);
      return;
    }
    
    try {
      // 直接使用微信的WebSocket API，不依赖全局变量
      wx.sendSocketMessage({
        data: JSON.stringify(message),
        success: (res) => {
          console.log('消息发送成功:', message);
        },
        fail: (err) => {
          console.error('发送消息失败:', err);
          
          // 尝试重连
          wx.showToast({
            title: '消息发送失败，正在重连',
            icon: 'none',
            duration: 2000
          });
          
          setTimeout(() => {
            this.initWebSocket();
            
            // 重连后再次尝试发送
            setTimeout(() => {
              this.sendMessage(message);
            }, 1000);
          }, 500);
        }
      });
    } catch (err) {
      console.error('发送消息异常:', err);
      
      wx.showToast({
        title: '连接已断开，请重试',
        icon: 'none',
        duration: 2000
      });
      
      // 重新初始化WebSocket
      this.initWebSocket();
    }
  },

  createRoom: function () {
    console.log('点击创建房间按钮');
    
    this.playButtonSound();
    wx.showLoading({
      title: '创建房间中...',
    });
    
    // 发送创建房间请求
    this.sendMessage({
      type: 'createRoom',
      playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家',
      timestamp: Date.now()
    });
    
    // 3秒后如果还没收到响应，隐藏loading并提示重试
    setTimeout(() => {
      if (!this.data.inRoom) {
        wx.hideLoading();
        wx.showToast({
          title: '创建房间超时，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }, 3000);
  },

  showJoinRoom: function () {
    this.playButtonSound()
    this.setData({
      showJoinInput: true
    })
  },

  cancelJoin: function() {
    this.playButtonSound()
    this.setData({
      showJoinInput: false,
      inputRoomId: ''
    })
  },

  onRoomIdInput: function (e) {
    this.setData({
      inputRoomId: e.detail.value
    })
  },

  joinRoom: function () {
    if (!this.data.inputRoomId) {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none'
      });
      return;
    }

    console.log('Joining room with ID:', this.data.inputRoomId);
    
    wx.showLoading({
      title: '加入房间中...',
    });
    
    this.sendMessage({
      type: 'joinRoom',
      roomId: this.data.inputRoomId,
      playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家',
      timestamp: new Date().getTime()
    });

    // 设置超时处理，如果3秒内没有收到响应，则提示重试
    this.joinRoomTimeout = setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '加入房间失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }, 3000);
  },

  quickMatch: function () {
    this.playButtonSound()
    wx.showLoading({
      title: '匹配中...',
    })
    
    this.sendMessage('matchGame', {
      playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家',
      avatarUrl: app.globalData.userInfo ? app.globalData.userInfo.avatarUrl : ''
    })
    
    setTimeout(() => {
      wx.hideLoading()
    }, 1000)
  },

  leaveRoom: function() {
    console.log('Leave room button clicked');
    
    // 添加确认对话框
    wx.showModal({
      title: '提示',
      content: '确定要退出房间吗？',
      success: (res) => {
        if (res.confirm) {
          console.log('Confirmed to leave room');
          this.sendMessage({
            type: 'leaveRoom',
            roomId: this.data.roomId,
            playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家',
            timestamp: new Date().getTime()
          });
          
          wx.showToast({
            title: '已离开房间',
            icon: 'success',
            duration: 1500
          });
          
          // 重置房间数据
          this.setData({
            inRoom: false,
            roomId: '',
            players: [],
            isReady: false,
            gameStarted: false,
            readyCount: 0,
            myCards: [],
            lastPlayedCards: []
          });
        } else {
          console.log('Cancelled leaving room');
        }
      }
    });
  },

  ready: function() {
    console.log('准备游戏按钮被点击');
    console.log('当前玩家信息:', app.globalData.userInfo);
    console.log('当前房间ID:', this.data.roomId);
    
    // 显示加载提示
    wx.showLoading({
      title: '准备中...',
      mask: true
    });
    
    // 发送准备消息
    const message = {
      type: 'ready',
      roomId: this.data.roomId,
      playerName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家',
      timestamp: Date.now()
    };
    console.log('发送准备消息:', message);
    
    this.sendMessage(message);
    
    // 立即更新本地状态以提供即时反馈
    this.setData({
      isReady: true
    });
    
    // 查找自己在玩家列表中的索引
    const currentPlayerIndex = this.data.players.findIndex(p => 
      p.name === (app.globalData.userInfo ? app.globalData.userInfo.nickName : '玩家')
    );
    
    if (currentPlayerIndex !== -1) {
      // 更新玩家列表中自己的准备状态
      const updatedPlayers = [...this.data.players];
      updatedPlayers[currentPlayerIndex].isReady = true;
      
      // 计算准备的玩家数量
      const readyCount = updatedPlayers.filter(p => p.isReady).length;
      
      this.setData({
        players: updatedPlayers,
        readyCount: readyCount
      });
      
      console.log('更新后的玩家列表:', updatedPlayers);
    } else {
      console.warn('未找到当前玩家在玩家列表中');
    }
    
    wx.hideLoading();
    
    wx.showToast({
      title: '已准备',
      icon: 'success',
      duration: 1500
    });
  },

  selectCard: function (e) {
    const index = e.currentTarget.dataset.index
    const cards = this.data.myCards
    cards[index].selected = !cards[index].selected
    this.setData({
      myCards: cards
    })
  },

  playCards: function () {
    const selectedCards = this.data.myCards.filter(card => card.selected)
    if (selectedCards.length > 0) {
      if (this.data.soundEnabled && this.playCardSound) {
        this.playCardSound.play()
      }
      
      this.sendMessage('playCards', {
        cards: selectedCards
      })
    } else {
      wx.showToast({
        title: '请选择要出的牌',
        icon: 'none'
      })
    }
  },

  pass: function () {
    this.playButtonSound()
    this.sendMessage('pass')
  },
  
  toggleSound: function() {
    const soundEnabled = !this.data.soundEnabled
    this.setData({
      soundEnabled: soundEnabled
    })
    
    if (soundEnabled) {
      if (this.bgm) {
        this.bgm.play()
      }
    } else {
      if (this.bgm) {
        this.bgm.pause()
      }
    }
    
    wx.showToast({
      title: soundEnabled ? '音效已开启' : '音效已关闭',
      icon: 'none'
    })
  },

  // 复制房间ID
  copyRoomId: function() {
    const roomId = this.data.roomId;
    if (!roomId) {
      wx.showToast({
        title: '房间ID不存在',
        icon: 'none'
      });
      return;
    }
    
    console.log('Copying room ID:', roomId);
    wx.setClipboardData({
      data: roomId,
      success: () => {
        this.setData({
          copyTooltip: '已复制'
        });
        
        setTimeout(() => {
          this.setData({
            copyTooltip: '复制'
          });
        }, 2000);
        
        wx.showToast({
          title: '房间ID已复制',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('Failed to copy room ID:', err);
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },
}) 