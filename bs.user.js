// ==UserScript==
// @name        OPR_brainStorming
// @namespace   asldufhiu32hr9283hf83123
// @include     https://wayfarer.nianticlabs.com/*
// @require     https://cdn.jsdelivr.net/gh/jquery/jquery@3/dist/jquery.min.js
// @updateURL    https://github.com/6582/1/raw/main/bs.meta.js
// @downloadURL  https://github.com/6582/1/raw/main/bs.user.js
// @version     6.2
// @run-at document-start
// @grant       none
// ==/UserScript==

/*
致 愛好審po的各位：
使用本script審po時，會把打分和comments自動傳送到server公開，其他使用者審到同樣的po時，會看得到別人打過的分數和comment。
目的是互相提醒、交流和學習，同時獨立思考，讓po審核更加盡善盡美。
你可以把需要注意的地方寫在 comment 中。

v6.2 17/5/2024
- 加入(以往存在的)評論文字輸入

v6 25/4/2024
6.1 - 上傳意見等待最多2秒後在背景繼續處理
6.0 - 需要update post URL，舊版本不能再用。

v5 23/8/2021
- 因為網站又更新修正

v4.0 x/01/2021
- 因為網站更新修正
- 等待記錄完成才繼續，以防止記錄不成功
- Edit 中的 report abuse 可被記錄
- 打 1 或 dup 也可同時記錄位置修訂
- passcode 改了在 UI 上設定，儲存在 localStorage (為方便bookmarklet)
	dev:
- 改用 jsdelivr 來載入 jQuery; 除了 @require, 需要時自動動態載入 (為方便bookmarklet)
- 重寫了結構，方便開發 mod 而不用對本 script 作改動
- 改了 html 的各種 class

v3.3.1 11/10/2019
- 適用新的網址

v3.3 18/4/2019
- 加入輔助圖片、文字的記錄

v3.2 27/9/2018
- 加入1星(低質/spam)的理由記錄

v3.1 緊急修正 25/8/2018
- 因對方系統改變，需要更新，否則"1星"的review不能成功紀錄到Brainstorming系統

v3.0 26/4/2018
- 改從Firebase讀取資料，能顯示更久遠的意見(不受sheet的容量限制)，更快速
- 與Cojad大的script相容

v2.0 20/12/2017
- 必須輸入帳號passcode
- 改為顯示6組星星的平均值
- 取消 duplicate 欄位，改為在 comment 加插文字
- 介面修改
- 舊版本不能再用

v1.1 6/12/2017
- 自動調整高度，加入scrollbar
- 更改欄位次序 (star author reason duplicate)

v1.0 26/10/2017
- 防止滑鼠連點時重複送出資料
- 介面樣式修改
- 載入完成前顯示 "⌛ Loading"
- 顯示 hashtag 以方便在 telegram 搜索
- 如修訂位置，會在你的 Comment 加插大約的方向和公尺(如: ⇖19m)
- 如果顯示意見有 comment，在分數旁顯示小圖示 "✍"
- 如果顯示意見有 修訂位置，在分數旁顯示小圖示 "📍"

v0.9 基本功能 8/2017
v0.6 31/7/2017
v0.5 30/7/2017
*/

window.bs = {
	_VERSION: "6.2",
	iOS: false,

	isQueryFromFirebase: true,
	isQueryFromSheet: false,

	imgUrlToHashId( url ){ return url.replace( /[^a-zA-Z0-9]/g, '' ).slice(-10).toLowerCase(); },

	// https://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript/4835406#4835406
	escapeHtml(text){
		if( text ){
			let map = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#039;',
			};
			return text.toString().replace(/[&<>"']/g, function(m){ return map[m]; } );
		}else{
			return "";
		}
	},
	
	parseJsonToPortal( json ){
		if( json==null ){
			return null;
		}
		
		let p = {
			reviews: [],
		};
		
		for (let key in json) {
			let o = json[key];
			if( o.author ){
				try{
					let t = {
						timestamp: o.Timestamp,
						author: o.author,
						stars: o.stars,
						reasons: o.reasons,
					};
					
					t.htmlEsc_author = this.escapeHtml( t.author );
					t.htmlEsc_stars = this.escapeHtml( t.stars );
					t.htmlEsc_reasons = this.escapeHtml( t.reasons );
					
					p.reviews.push( t );
				}catch(error){}
			}
		}

		return p;
	},

	showReviewsFirebase(){
		let p = this.parseJsonToPortal( this.firebaseJsonObj );

		if( p==null ){
			this.Pane.$otherReviews_firebase.html( "(未有資料 / no data)<br>" );
			this.Pane.$div_notification_icons.empty();
			return;
		}
		
		let notification_icons = "";
		let html_review = /*html*/`<table>
			<tr class='head'>
				<th class='stars'>stars</th>
				<th class='author'>reviewer</th>
				<th class='reasons'>comments</th>
			</tr>`;
			
		for( let i=0; i<p.reviews.length; i++ ){
			let r = p.reviews[i];
			
			let hasNewlocation = /\[📍.+m\]/.test( r.reasons );
			let hasComment = !( /^(\[(📍.+m|dup:.+)\]\s*)+$|^\s*$/.test( r.reasons ) );

			html_review += /*html*/`
				<tr
						class='${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'
						title='${(i+1)}) ${new Date(r.timestamp).toLocaleString()}'>
					<td class='stars'>${r.htmlEsc_stars}</td>
					<td class='author'>${r.htmlEsc_author}</td>
					<td class='reasons'>${r.htmlEsc_reasons} <span class='date'>(${new Date(r.timestamp).toLocaleDateString()})</span></td>
				</tr>`;

			// notification
			notification_icons += /*html*/`
				<p class='item ${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'>
				${r.stars}
				${hasComment ? "✍" : ""}
				${hasNewlocation ? "📍" : ""}
				</p>`;
		}
		
		html_review += "</table>";
		this.Pane.$otherReviews_firebase.html( html_review );
		this.Pane.$div_notification_icons.html(notification_icons);
	},

	showReviewsSheet(){
		let json = this.sheetJsonObj;

		if( json.table.rows.length == 0 ){
			this.Pane.$otherReviews_sheet
				.html( "(未有資料 / no data)<br>" );
			if( !this.isQueryFromFirebase ) this.Pane.$div_notification_icons.empty();
			return;
		}
		
		var notification_icons = "";
		var col_stars = 0;
		var col_author = 1;
		var col_comment = 2;
	
		var html = "<table>";
		html += "<tr>";
		for( var i=0; i<3; i++ ){
			var label = this.escapeHtml(json.table.cols[i].label);
			html += `<th class="${label}">${label}</th>`;
		}
		html += "</tr>";
		
		for( var i=0; i<json.table.rows.length; i++ ){
			var userId = json.table.rows[i].c[col_author].v;
			var hasComment = false;
			var hasNewlocation = false;
			
			var star = 0;
			
			for( var k=0; k<3; k++ ){
				var r = json.table.rows[i].c[k];
				if( k==col_stars ){
					star = r ? (r.v==0? "." : (r.v).toFixed(1)) : "D";
					html += `<td class='stars'>${star}</td>`;
				}else{
					var value1 = (r==null ? "" : this.escapeHtml(r.v) );
					html += `<td class="${k==col_author?"author":"reasons"}">${value1}</td>`;
					
					if( k==col_comment ){
						if( ! /^\s*$/.test(value1) ){
							hasNewlocation = /\[📍.+m\]/.test( r.reasons );
							hasComment = !( /^(\[(📍.+m|dup:.+)\]\s*)+$|^\s*$/.test( r.reasons ) );
						}
					}
				}
			}
			
			notification_icons += /*html*/`
				<p class='item ${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'>
				${star}
				${hasComment ? "✍" : ""}
				${hasNewlocation ? "📍" : ""}
				</p>`;
			
			html += "</tr>";
		}
		
		html += "</table>";
	
		this.Pane.$otherReviews_sheet.html( html );
		if( !this.isQueryFromFirebase ) this.Pane.$div_notification_icons.html(notification_icons);
	},
	
	queryReviewsFromFirebase(){
		let hashID = this.hashID;
		// hashID = "9os32nej78";
		$.getJSON(
			`https://oprbrainstorming.firebaseio.com/c/reviews/${hashID}.json`,
			data=>{
				this.firebaseJsonObj = data;
				this.showReviewsFirebase();
			}
		);
	},

	queryReviewsFromSheet(){
		window.google = window.google || {};
		window.google.visualization = window.google.visualization || {};
		window.google.visualization.Query = window.google.visualization.Query || {};
		window.google.visualization.Query = { // handler for google Sheet's Query
			setResponse: json=>{
				this.sheetJsonObj = json;
				this.showReviewsSheet.apply(this);
			}
		};
	
		let QUERY = "https://docs.google.com/spreadsheets/d/1qNgNT73vrgyD8fg8VZjBXl0wtNnv0YOYeakMaODiLSU/gviz/tq?tq="
			+ encodeURIComponent( `select I,H,J where B='${this.pageData.imageUrl}'` );
			//+ encodeURIComponent( "select I,H,J where B='"+"http://lh3.googleusercontent.com/lnKhxhS35rhum-wT2Q9FBnj1XUe73SC3RM4yqNEWUkfvUU_B6W0_ZZG1rZJshIOMYSLNB3VDrnjJxUUpIVg"+"'" );
			// + encodeURIComponent( "select I,H,J order by A desc LIMIT 19" );
			
		$.getScript( QUERY );
	},
};

bs.postPortal = function( d ){
	if( !this.passcode ) return;

	let reviewData = JSON.parse( d );
	// console.log( reviewData );

	// TODO: 就算 1星 也可傳送移位點
	// try{
	// 	let locationMarker = this.ReviewResponsesService.getNewLocationMarker();
	// 	if( null != locationMarker ){
	// 		let p = locationMarker.getPosition();
	// 		reviewData.newLocation = `${p.lat()}, ${p.lng()}`;
	// 	}
	// }catch(error){}
	
	// dup
	if( reviewData.duplicate ){
		reviewData.duplicateTitle =
			this.pageData.nearbyPortals
				.find( p=>p.guid==reviewData.duplicateOf )
					.title;
	}
	
	// removes unnecessary data.
	delete this.pageData.nearbyPortals;
	delete this.pageData.prediction;
	
	let postData = {
		pageData: this.pageData,
		reviewData,
		passcode: this.passcode,
		version: +this._VERSION,
		iOS: this.iOS,
		comment: document.querySelector("#bsComment_5k8qr4 textarea")?.value ?? "",
	};

	this.PostingLoader.show();

	// console.log( postData );

	return $.post(
		"https://script.google.com/macros/s/AKfycbzNYqJOCJGvTo8rvAZM3YDM93POz-bmUN4i9BWA9yIjvtd4K_w5UeRQdZ78QKmtgKm5og/exec",
		JSON.stringify( postData )
	).done( result=>{
		try{
			let msg = JSON.parse(result).msg;
			if( msg != "ok" ) alert( msg );
		}catch(error){};
	} )
	.always( ()=>{ // finally is not supported by some browsers.
		this.PostingLoader.hide();
	} );
};

/**
 * 為了方便 extend 或建立 mod
 */
bs.loadOverrides = function(){
	Object.assign( this, window.bsOverrides ); // assign all var and functions from bsOverrides to bs
	
	// run every values in beforeInit as function
	for( let func in this.beforeInit || {} ){ 
		try {
			this.beforeInit[func].apply( this );
		} catch (error) {
			console.log( error );
		}
	}
};

bs.isIOS = function() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod',
		'MacIntel', // for iPads running iOS 13 or later
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

bs.fix_iOS_hover = function(){
	document.querySelector('html').setAttribute('ontouchmove','');
	document.body.setAttribute('tabIndex',"0");
};

bs.initPasscode = function(){
	// 優先次序: 1.bsOverrides 2.localStorage
	this.passcode = this.passcode || localStorage.BSpasscode || "";

	try {
		// 如果user連前面的 `var passcode = "` 也輸入了，取出 str 部份
		this.passcode = this.passcode.match( /"(.*)"/ )[1];
	} catch (error) {}

	if( !this.passcode ){
		this.Pane.$el.find(".otherReviews").html( "<br><br>必須輸入 passcode 才能運作。<br>請申請一個 passcode 並在上方設定<br>設定後須要重新載入頁面。" );
		this.Pane.$div_notification_icons.html(
			`<p class="item">⚠️</p>`
		);
	}
};

bs.editPasscode = function(){
	let str = prompt(
		`[passcode]:

可輸入
var passcode="name_xxx";
或 
name_xxx`,
		localStorage.BSpasscode || ""
	);

	if( str!==null ){
		localStorage.BSpasscode = str.trim();
		this.initPasscode();

		if( confirm("passcode修改後，需要重新載入，選'OK'重新載入。") ){
			location.reload();
		}
	}
};

bs.injectBsFunctions = function(){
	let bs = this;

	let func = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function( method, url ){
		if( url=="/api/v1/vault/review" ){
			if( method=="GET" ){
				this.addEventListener( 'load', function(){
					bs.loadNewPortal(
						JSON.parse(this.responseText).result
					);
				} );
			} else { // POST
				let send2 = this.send;
				this.send = function (d) {
					const postPortalPromise = bs.postPortal(d).catch(error => {
						console.log(error);
						alert(`🤔bs 上傳失敗 - ${error.message}\n${error.stack}`);
					});

					const timeoutPromise = new Promise(resolve =>
						setTimeout(resolve, 2000)
					);

					// Wait for either the postPortalPromise or the timeoutPromise to resolve
					Promise.race([
						postPortalPromise,
						timeoutPromise
					]).then(() => {
						return send2.apply(this, arguments);
					});
				};
			}
		}
		return  func.apply(this, arguments);
	}
};

/**
 * 為了 script 獨立執行時，沒有 @require 到 jQuery
 */
bs.jQueryReady = function(){
	return new Promise( (resolve,reject)=>{
		if(window.jQuery){
			resolve();
		}else{
			var script = document.createElement("script");
			script.src = "https://cdn.jsdelivr.net/gh/jquery/jquery@3/dist/jquery.min.js";
			script.onload = resolve;
			script.onerror = reject;
			
			document.head.appendChild(script);
		}
	});
};

bs.documentReady = function(){
	return new Promise( resolve=>{
		let timer = setInterval( ()=>{
			if( document.readyState=='complete' ){
				clearInterval( timer );
				resolve();
			}
		}, 99 );
	});
};

bs.init = function(){
	this.injectBsFunctions();

	return this.documentReady()
		.then( this.jQueryReady.bind(this)	)
		.then( this.loadOverrides.bind(this) )
		.then( ()=>{
			this.iOS = this.isIOS();
			if( this.iOS ){
				this.fix_iOS_hover();
			}

			this.initTimerForAddingBSCommentField();
			
			this.Pane.init( this );
			this.PostingLoader.init();
			this.initPasscode();

			if( this.passcode && !this.pageData ){
				this.Pane.$el.find(".otherReviews").append( /*html*/
					`<br><br><hr><br>未取得本頁的審po內容，請在審po官方menu轉到其他頁再轉回來「★REVIEW」 (不是 reload page)`
				);
				this.Pane.$div_notification_icons.html(
					`<p class="item">⚠️</p>`
				);
			}
		} );
};

bs.loadNewPortal = function( pageData ){
	// console.log(pageData);
	if( this.passcode ){
		this.pageData = pageData;
		this.hashID = this.imgUrlToHashId( this.pageData.imageUrl );
		this.Pane.showNewPortal();
		if( this.isQueryFromSheet ){
			this.queryReviewsFromSheet();
		}
		if( this.isQueryFromFirebase ){
			this.queryReviewsFromFirebase();
		}
	}
};

bs.initTimerForAddingBSCommentField = function(){
	setInterval(()=>{
		if( ! location.href.includes("new/review") ) return;
		if( this.pageData?.type != "NEW" ) return;
		if( document.getElementById("bsComment_5k8qr4") ) return;

		document.querySelector("#categorization-card")?.
			insertAdjacentHTML("afterbegin", /*html*/ `
				<div id="bsComment_5k8qr4">
					<textarea placeholder="在此輸入提交到 brainstorming 的評論... (只提交到bs)"></textarea>
				</div>
				<style>
					#bsComment_5k8qr4{
						width: 100%;
		
						display: flex;
						flex-direction: column;
						padding: 7px 10px;
		
						border: 1px solid #71ffff;
						color: #71ffff;
						background-color: #014949;
					}
					#bsComment_5k8qr4 textarea{
						height: 4.3em;

						border: 1px solid #716666;
						color: #003838;
						background-color: #e1f7f7;
					}
			</style>
			`);

	}, 777);
}

bs.Pane = {
	$el:null,
	$div_notification_icons:null,
	$otherReviews_firebase:null,
	$otherReviews_sheet:null,
	init( bs ){
		this.bs = bs;

		this.$el =  $(/*html*/`
			<div id="brainStorming">
				<div class="briefing">
					<span class="versionNo">v${bs._VERSION}</span>
					※使用本script時，評分意見會傳送到server公開 
					※其他人的意見僅作參考，請為了良好的遊戲環境努力審核，獨立思考，集思廣益
				</div>
				<div class="buttons">
					<input class="T_hashtag" size="15" onClick="this.select();" readonly />
					<a class="link" onclick="bs.editPasscode()">passcode</a>
					<a class="link link_watermeter" target="_blank" href="https://brainstorming.azurewebsites.net/watermeter.html"><span class="short">查</span><span class="long">水表</span></a> 
					<a class="link" target="_blank" href="https://brainstorming.azurewebsites.net/bs.html"><span class="short">牆</span><span class="long">wall</span></a>
					<a class="link" target="_blank" href="https://docs.google.com/spreadsheets/d/e/2PACX-1vSrXYajaKHfO0aDANr-aFu61DEzB0wy5X87uQUBKFza__1J7ttnqJh_84Gvp9-tETIzjbiK_yPx7Llk/pubhtml?gid=621294114&single=true"><span class="short">統</span><span class="long">使用統計</span></a>
				</div>
			</div>
		`)

		this.$el.append(
			bs.isQueryFromFirebase && (
				this.$otherReviews_firebase =$(/*html*/
				`<div class="otherReviews otherReviews_firebase"></div>`)
			),
			bs.isQueryFromSheet && (
				this.$otherReviews_sheet = $(/*html*/
				`<div class="otherReviews otherReviews_sheet"></div>`)
			),
			this.$div_notification_icons = $(/*html*/
				`<div class="div_notification_icons"></div>`),
		);
			
		$(document.body).append(this.css, this.$el );
	},
	showNewPortal(){
		this.$el
			.find(".T_hashtag").val(`#${bs.hashID}`).end()
			.find(".link_watermeter").attr(
				"href", `https://brainstorming.azurewebsites.net/watermeter.html#${bs.hashID}`
			).end()
			.find(".otherReviews").html(" ⌛ Loading...");
		
		this.$div_notification_icons.html(`<span class="loading">⌛</span>`);
	},
	css:/*html*/`
		<style>
			#brainStorming{
				--W_PANE: 500px;
				--W_SIDE: 30px;

				top:60px; left: calc(100% - var(--W_SIDE));
				max-width:95%;
				width: var(--W_PANE);
				min-height: 200px;
				max-height: calc(100vh - 80px);

				position: fixed;
				z-index: 99999;

				border: 1px solid #71ffff;
				color: #71ffff;
				background-color: #013030;

				overflow-y: auto;
				padding-bottom: 15px;
				padding-left: calc(var(--W_SIDE) + 3px);
				padding-right: 5px;
			}

			#brainStorming:hover {right:0px !important; left: unset !important; padding-left:5px !important; } 
			#brainStorming:hover > .div_notification_icons { display: none;} 
			
			#brainStorming .versionNo{
				margin-right: 5px;
				color: #778833;
				font-weight: bold;
			}

			#brainStorming .briefing{
				margin-bottom: 9px;
			}

			#brainStorming .T_hashtag{
				background-color:#194848; color:#71AAAA; border: 1px solid #71AAAA; text-align:center; height: 27px;
			}

			#brainStorming .link { color: #77FFFF; border: 1px solid #105050; display: inline-block; padding: 0px 4px; margin-left: 3px; height: 26px; } 
			#brainStorming .link:hover { color: #DD2CFF; text-decoration: underline; } 

			#brainStorming .link .long { display:none; }
			@media (min-width: 700px) {
				#brainStorming .link .long { display:inline; }
				#brainStorming .link .short { display:none; }
			}

			.otherReviews{
				margin-top:10px; margin-bottom:10px;
			}

			.otherReviews>table{
				width:100%;
				table-layout: fixed;
			} 
			.otherReviews>table, .otherReviews>table th, .otherReviews>table td{
				border:1px solid #71ffff;
				background-color:black;
			}

			.otherReviews>table th {
				font-weight: bold;
				text-align:center;
				padding: 2px;
			}
			.otherReviews>table th.stars {
				width: 50px;
			}
			.otherReviews>table th.author {
				width: 130px;
			}

			.otherReviews>table td.reasons .date {
				color: #B0B0B0;
				font-size: 65%;
			}
			.otherReviews>table td{
				color:white;
				vertical-align: middle;
				padding: 2px;
				overflow-wrap:break-word;
			}
			.otherReviews>table td.stars {
				text-align:center;
				font-size:20px;
			}
			
			.div_notification_icons{
				position: absolute;
				left:0; top:0;
				height: 100%;
				width: var(--W_SIDE);
				overflow-wrap: break-word;
				text-align: center;
				font-size: 21px;
				background-color: #1a5757;
			}
			
			.div_notification_icons>.loading{
				font-size:27px;
			}
			
			.div_notification_icons>.item {
				padding-bottom:4px; margin-bottom:6px; line-height:0.92em; background-color:#012020;
			}
		</style>
	`,
};

bs.PostingLoader = {
	$el:null,
	showCount:0, // in case multiple postings happen simultaneously
	init(){
		this.$el = $(this.html).hide();
		$(document.body).append( this.css, this.$el );
	},
	show(){
		this.showCount++;
		this.$el.toggle(this.showCount>0);
	},
	hide(){
		this.showCount--;
		this.$el.toggle(this.showCount>0);
	},
	html:/*html*/`
		<div class="bsPostingLoader">
			<img class="loader rotating" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAOUlEQVQYlWNgQAX/0TBW8P//QXYUjE0xhiJsijEkkGlkxThNo1BhuBKyIB53hiuhYrw+J0IRwQAHAArxntwkepFwAAAAAElFTkSuQmCC">
			<div class="text">posting to Brainstorming...</div>
		</div>
	`,
	css:/*html*/`
		<style>
			.bsPostingLoader {
				position: absolute;
				z-index: 999;
				top: 0;
				height: 50px;
				left: 0;
				right: 0;
				display: flex;
				justify-content: center;
				align-items: center;
				flex-direction: row;
				opacity: 0.9;
			}
			.bsPostingLoader .text{
				margin-left: 1em;
			}
			.bsPostingLoader .loader{
				width: 50px;
				image-rendering:-moz-crisp-edges;          /* Firefox        */
				image-rendering:-o-crisp-edges;            /* Opera          */
				image-rendering:crisp-edges;               /* CSS4 Proposed  */
				image-rendering:pixelated;                 /* CSS4 Proposed  */
			}
			.bsPostingLoader .rotating{
				animation: rotation 3.3s infinite linear;
			}
			@keyframes rotation {
				from {
					transform: rotate(0deg);
				}
				to {
					transform: rotate(359deg);
				}
			}
		</style>
	`,
};

bs.init()
	.catch( console.error );
