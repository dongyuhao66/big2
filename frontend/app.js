App({
  globalData: {
    userInfo: null,
    websocketConnected: false,
    socketTask: null,
    socketConnected: false,
    serverUrl: 'ws://localhost:8080/ws',
    playerName: ''
  },

  onLaunch: function () {
    console.log('应用启动，当前服务器URL:', this.globalData.serverUrl);
    
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: res => {
              this.globalData.userInfo = res.userInfo
              
              // 设置玩家名称
              this.globalData.playerName = res.userInfo.nickName
              
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res)
              }
            }
          })
        } else {
          // 如果未授权，使用随机名称
          this.globalData.playerName = '玩家' + Math.floor(Math.random() * 1000)
        }
      }
    })
  }
}) 