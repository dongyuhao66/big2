# 四川泸州大二棋牌游戏资源下载脚本
# 作者: AI助手
# 用途: 下载游戏所需的图片和音效资源

# 设置TLS 1.2，确保HTTPS可以正常工作
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 创建必要的目录结构
$baseDir = "frontend"
$imageDir = "$baseDir/images"
$cardsDir = "$baseDir/images/cards"
$soundsDir = "$baseDir/sounds"

# 确保目录存在
if (!(Test-Path $imageDir)) {
    New-Item -ItemType Directory -Path $imageDir -Force
    Write-Host "创建目录: $imageDir"
}

if (!(Test-Path $cardsDir)) {
    New-Item -ItemType Directory -Path $cardsDir -Force
    Write-Host "创建目录: $cardsDir"
}

if (!(Test-Path $soundsDir)) {
    New-Item -ItemType Directory -Path $soundsDir -Force
    Write-Host "创建目录: $soundsDir"
}

# 下载函数
function Download-File {
    param(
        [string]$Url,
        [string]$OutputFile
    )
    
    try {
        Write-Host "下载中: $Url -> $OutputFile" -ForegroundColor Cyan
        Invoke-WebRequest -Uri $Url -OutFile $OutputFile
        if (Test-Path $OutputFile) {
            Write-Host "✓ 下载完成: $OutputFile" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "× 下载失败: $Url" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# 图片资源 URLs
$images = @{
    # 基本界面图片
    "$imageDir/logo.png" = "https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png/back.png"
    "$imageDir/bg.jpg" = "https://img.freepik.com/free-photo/green-poker-table-background_55716-576.jpg?w=1380&t=st=1712495407~exp=1712496007~hmac=286a08df27acf7c19224dd8b29da8c300923fe36b1d5f2c33aadfb59c8da38bf"
    "$imageDir/sound-on.png" = "https://img.icons8.com/material-rounded/96/ffffff/high-volume.png"
    "$imageDir/sound-off.png" = "https://img.icons8.com/material-rounded/96/ffffff/no-audio.png"
    "$imageDir/default-avatar.png" = "https://img.icons8.com/fluency/96/person-male.png"
    
    # 可以添加更多图片...
}

# 扑克牌图片 URLs (使用开源扑克牌资源)
$suits = @("SPADES", "HEARTS", "CLUBS", "DIAMONDS")
$ranks = @("TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "JACK", "QUEEN", "KING", "ACE")

# 从GitHub下载扑克牌图片
$cardImageBaseUrl = "https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png/"

# 映射花色和牌面值到文件名
$suitMapping = @{
    "SPADES" = "spades"
    "HEARTS" = "hearts"
    "CLUBS" = "clubs"
    "DIAMONDS" = "diamonds"
}

$rankMapping = @{
    "TWO" = "2"
    "THREE" = "3"
    "FOUR" = "4"
    "FIVE" = "5"
    "SIX" = "6"
    "SEVEN" = "7"
    "EIGHT" = "8"
    "NINE" = "9"
    "TEN" = "10"
    "JACK" = "jack"
    "QUEEN" = "queen"
    "KING" = "king"
    "ACE" = "ace"
}

# 音效资源 URLs
$sounds = @{
    "$soundsDir/bgm.mp3" = "https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3"
    "$soundsDir/deal.mp3" = "https://assets.mixkit.co/sfx/preview/mixkit-paper-slide-1530.mp3"
    "$soundsDir/play_card.mp3" = "https://assets.mixkit.co/sfx/preview/mixkit-quick-jump-arcade-game-239.mp3"
    "$soundsDir/button.mp3" = "https://assets.mixkit.co/sfx/preview/mixkit-light-switch-sound-2589.mp3"
    
    # 可以添加更多音效...
}

Write-Host "==== 开始下载基本图片资源 ====" -ForegroundColor Yellow
foreach ($key in $images.Keys) {
    Download-File -Url $images[$key] -OutputFile $key
}

Write-Host "==== 开始下载扑克牌图片 ====" -ForegroundColor Yellow
foreach ($suit in $suits) {
    foreach ($rank in $ranks) {
        $suitLower = $suitMapping[$suit]
        $rankLower = $rankMapping[$rank]
        
        $outputFile = "$cardsDir/${suit}_${rank}.png"
        $url = "${cardImageBaseUrl}${rankLower}_of_${suitLower}.png"
        
        Download-File -Url $url -OutputFile $outputFile
    }
}

Write-Host "==== 开始下载音效资源 ====" -ForegroundColor Yellow
foreach ($key in $sounds.Keys) {
    Download-File -Url $sounds[$key] -OutputFile $key
}

Write-Host "`n==== 资源下载完成 ====" -ForegroundColor Green
Write-Host "图片存放路径: $imageDir"
Write-Host "卡片图片存放路径: $cardsDir" 
Write-Host "音效存放路径: $soundsDir"
Write-Host "`n现在可以启动你的微信小程序项目了!" 