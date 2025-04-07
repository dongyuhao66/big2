// WebSocket测试页面
const app = getApp()

Page({
  data: {
    connected: false,
    messages: [],
    inputMessage: '',
    serverUrl: app.globalData.serverUrl
  },

  onLoad: function () {
    this.connectWebSocket()
  },

  connectWebSocket: function () {
    wx.showLoading({
      title: '连接中...',
    })
    
    // 清除之前的事件监听
    try {
      wx.closeSocket()
    } catch (e) {
      console.log('没有已存在的WebSocket连接')
    }
    
    wx.onSocketOpen(null)
    wx.onSocketError(null)
    wx.onSocketMessage(null)
    wx.onSocketClose(null)
    
    // 连接WebSocket
    wx.connectSocket({
      url: this.data.serverUrl,
      success: (res) => {
        console.log('连接请求已发送', res)
        this.addMessage('系统', '连接请求已发送')
      },
      fail: (err) => {
        console.error('连接失败', err)
        this.addMessage('错误', '连接失败: ' + JSON.stringify(err))
        wx.hideLoading()
      }
    })
    
    // 监听事件
    wx.onSocketOpen((res) => {
      console.log('WebSocket已连接', res)
      this.setData({
        connected: true
      })
      this.addMessage('系统', 'WebSocket已连接!')
      wx.hideLoading()
    })
    
    wx.onSocketMessage((res) => {
      console.log('收到消息', res.data)
      try {
        const data = JSON.parse(res.data)
        this.addMessage('服务器', JSON.stringify(data, null, 2))
      } catch (e) {
        this.addMessage('服务器', res.data)
      }
    })
    
    wx.onSocketClose((res) => {
      console.log('连接已关闭', res)
      this.setData({
        connected: false
      })
      this.addMessage('系统', '连接已关闭')
    })
    
    wx.onSocketError((err) => {
      console.error('WebSocket错误', err)
      this.addMessage('错误', 'WebSocket错误: ' + JSON.stringify(err))
      wx.hideLoading()
    })
  },
  
  addMessage: function (from, content) {
    const time = new Date().toLocaleTimeString()
    const messages = this.data.messages
    messages.push({ from, content, time })
    this.setData({
      messages
    })
  },
  
  sendPing: function () {
    if (!this.data.connected) {
      wx.showToast({
        title: '请先连接WebSocket',
        icon: 'none'
      })
      return
    }
    
    const message = {
      type: 'ping',
      data: new Date().toISOString()
    }
    
    wx.sendSocketMessage({
      data: JSON.stringify(message),
      success: () => {
        this.addMessage('客户端', '发送: ' + JSON.stringify(message))
      },
      fail: (err) => {
        console.error('发送失败', err)
        this.addMessage('错误', '发送失败: ' + JSON.stringify(err))
      }
    })
  },
  
  sendCustomMessage: function () {
    if (!this.data.connected) {
      wx.showToast({
        title: '请先连接WebSocket',
        icon: 'none'
      })
      return
    }
    
    if (!this.data.inputMessage) {
      wx.showToast({
        title: '请输入消息',
        icon: 'none'
      })
      return
    }
    
    try {
      const message = JSON.parse(this.data.inputMessage)
      
      wx.sendSocketMessage({
        data: JSON.stringify(message),
        success: () => {
          this.addMessage('客户端', '发送: ' + JSON.stringify(message))
          this.setData({
            inputMessage: ''
          })
        },
        fail: (err) => {
          console.error('发送失败', err)
          this.addMessage('错误', '发送失败: ' + JSON.stringify(err))
        }
      })
    } catch (e) {
      wx.showToast({
        title: '消息格式必须是有效的JSON',
        icon: 'none'
      })
    }
  },
  
  reconnect: function () {
    this.connectWebSocket()
  },
  
  clearMessages: function () {
    this.setData({
      messages: []
    })
  },
  
  onInputChange: function (e) {
    this.setData({
      inputMessage: e.detail.value
    })
  },
  
  copyMessages: function () {
    wx.setClipboardData({
      data: this.data.messages.map(m => `[${m.time}] ${m.from}: ${m.content}`).join('\n'),
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
        })
      }
    })
  },
  
  onUnload: function () {
    // 页面卸载时关闭连接
    if (this.data.connected) {
      wx.closeSocket()
    }
  }
}) 