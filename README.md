# 書籤小程式 bookmarklet (iOS Safari 可使用)
執行內容是載入 https://cdn.jsdelivr.net/gh/6582/1/bs.user.js

** 審第一個的時候暫未能使用

`
javascript:(function(F,i,r,e,k,u,I,E){if(F.getElementById(k))return;E=F[i+'NS']&&F.documentElement.namespaceURI;E=E?F[i+'NS'](E,'script'):F[i]('script');E[r]('id',k);E[r]('src',I);E[r](k,u);(F[e]('head')[0]||F[e]('body')[0]).appendChild(E);})(document,'createElement','setAttribute','getElementsByTagName','MyScript','4','https://cdn.jsdelivr.net/gh/6582/1/bs.user.js?'+Math.floor(Date.now()/100000000));
`


## 安裝方法可參考:
- https://sspai.com/post/26196
- https://kknews.cc/tech/69p22kl.html
