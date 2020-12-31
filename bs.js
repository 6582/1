// ==UserScript==
// @name        OPR_brainStorming
// @namespace   asldufhiu32hr9283hf83123
// @author       lokpro
// @include     https://wayfarer.nianticlabs.com/review*
// @require     https://cdn.jsdelivr.net/gh/jquery/jquery@3.5.1/dist/jquery.min.js
// @updateURL    http://brainstorming.azurewebsites.net/OPR_brainStorming/OPR_brainStroming_update.user.js
// @downloadURL  http://brainstorming.azurewebsites.net/OPR_brainStorming/OPR_brainStroming.user.js
// @version     3.997
// @run-at document-idle
// @grant       none
// ==/UserScript==

/*
致 愛好審po的各位：
使用本script審po時，會把打分和comments自動傳送到server公開，其他使用者審到同樣的po時，會看得到別人打過的分數和comment。
目的是互相提醒、交流和學習，同時獨立思考，讓po審核更加盡善盡美。
你可以把需要注意的地方寫在 comment 中。

v4.0 xx/12/2020
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


// JSON.decycle() - https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
"function"!=typeof JSON.decycle&&(JSON.decycle=function(n,e){"use strict";var t=new WeakMap;return function n(c,o){var i,r;return void 0!==e&&(c=e(c)),"object"!=typeof c||null===c||c instanceof Boolean||c instanceof Date||c instanceof Number||c instanceof RegExp||c instanceof String?c:void 0!==(i=t.get(c))?{$ref:i}:(t.set(c,o),Array.isArray(c)?(r=[],c.forEach(function(e,t){r[t]=n(e,o+"["+t+"]")})):(r={},Object.keys(c).forEach(function(e){r[e]=n(c[e],o+"["+JSON.stringify(e)+"]")})),r)}(n,"$")});

window.bs = {
	_VERSION: "3.997",//"4.0",
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
			this.$otherReviews_firebase.html( "(未有資料 / no data)<br>" );
			this.$div_notification_icons.empty();
			return;
		}
		
		let notification_icons = "";
		let html_review = `<table>
			<tr class='head'>
				<th class='stars'>stars</th>
				<th class='author'>reviewer</th>
				<th class='reasons'>comments</th>
			</tr>`;
			
		for( let i=0; i<p.reviews.length; i++ ){
			let r = p.reviews[i];
			
			let hasNewlocation = /\[📍.+m\]/.test( r.reasons );
			let hasComment = !( /^(\[(📍.+m|dup:.+)\]\s*)+$|^\s*$/.test( r.reasons ) );

			html_review += `
				<tr
						class='${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'
						title='${(i+1)}) ${new Date(r.timestamp).toLocaleString()}'>
					<td class='stars'>${r.htmlEsc_stars}</td>
					<td class='author'>${r.htmlEsc_author}</td>
					<td class='reasons'>${r.htmlEsc_reasons} <span class='date'>(${new Date(r.timestamp).toLocaleDateString()})</span></td>
				</tr>`;

			// notification
			notification_icons +=
				`<p class='item ${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'>`
				+r.stars
				+(hasComment ? "✍" : "")
				+(hasNewlocation ? "📍" : "")
				+"</p>";
		}
		
		html_review += "</table>";
		this.$otherReviews_firebase.html( html_review );
		this.$div_notification_icons.html(notification_icons);
	},

	showReviewsSheet(){
		let json = this.sheetJsonObj;

		if( json.table.rows.length == 0 ){
			this.$otherReviews_sheet.html( "(未有資料 / no data)<br>" );
			if( !this.isQueryFromFirebase ) this.$div_notification_icons.empty();
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
			
			notification_icons +=
				`<p class='item ${hasComment?"hasComment":""} ${hasNewlocation?"hasNewlocation":""}'>`
				+star
				+(hasComment ? "✍" : "")
				+(hasNewlocation ? "📍" : "")
				+"</p>";
			
			html += "</tr>";
		}
		
		html += "</table>";
	
		this.$otherReviews_sheet.html( html );
		if( !this.isQueryFromFirebase ) this.$div_notification_icons.html(notification_icons);
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

bs.postPortal = function(){
	if( this.postedOnceAlready ){
		return;
	}else{
		this.postedOnceAlready = true;
	}
	
	let reviewData = this.ReviewResponsesService.getReviewSubmissionFormData();
	let editData = this.ReviewResponsesService.getEditSubmissionFormData();
	let photoData = this.ReviewResponsesService.getPhotoSubmissionFormData();
	
	try{
		let locationMarker = this.ReviewResponsesService.getNewLocationMarker();
		if( null != locationMarker ){
			let p = locationMarker.getPosition();
			reviewData.newLocation = `${p.lat()}, ${p.lng()}`;
		}
	}catch(error){}
	
	// dup
	if( reviewData.duplicate ){
		reviewData.duplicateTitle =
			this.pageData.nearbyPortals
				.find( p=>p.guid==reviewData.duplicateOf )
					.title;
	}
	
	// deep copy pageData, for removing unnecessary data.
	let pageData2 = JSON.parse( JSON.stringify( JSON.decycle(this.pageData) ) );
	delete pageData2.nearbyPortals;
	delete pageData2.prediction;
	
	let postData = this.postData = {
		pageData: pageData2,
		reviewData,
		editData,
		photoData,
		passcode: this.passcode,
		version: +this._VERSION,
		iOS: this.iOS,
	};

	try{
		postData.comment = $(".comments-input").val();
	}catch(error){}

	this.PostingLoader.show();

	return $.post(
		"https://script.google.com/macros/s/AKfycbx40e7IMYSRdBil1gDp2TrqE4loejar8oAnQaCXwn4SrG03ZPcz/exec",
		JSON.stringify( JSON.decycle(postData) )
	).done( result=>{
		try{
			let msg = JSON.parse(result).msg;
			if( msg != "ok" ) alert( msg );
		}catch(error){};
	} )
	.always( ()=>{
		this.PostingLoader.hide();
	} );
};

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
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

bs.fix_iOS_hover = function(){
	document.querySelector('html').setAttribute('ontouchmove','');
	document.body.setAttribute('tabIndex',"0");
};

bs.waitForPageData = function(){
  return new Promise( resolve => {
		let interval = setInterval( ()=>{
			try{	
				this.reviewCtrl = angular.element(document.getElementById('ReviewController')).scope().reviewCtrl;
				this.pageData = this.reviewCtrl.pageData;
				this.ReviewResponsesService = angular.element(document.getElementById("ReviewController")).injector().get("ReviewResponsesService");

				this.hashID = this.imgUrlToHashId( this.pageData.imageUrl );
			}catch( error ){
				return;
			}

			// data ready
			clearInterval( interval );
			resolve();
		}, 127);
	} )
};

bs.initPasscode = function(){
	// 優先次序: 1.bsOverrides 2.localStorage
	this.passcode = this.passcode || localStorage.BSpasscode || "";

	try {
		// 如果user連前面的 `var passcode = "` 也輸入了，取出 str 部份
		this.passcode = this.passcode.match( /"(.*)"/ )[1];
	} catch (error) {}
};

bs.editPasscodeInlocalStorage = function(){
	let str = prompt(
		`passcode:

可輸入 var passcode="xxx"; 或 xxx

設定後須要重新載入頁面`,
		localStorage.BSpasscode || ""
	);

	if( str!==null ){
		localStorage.BSpasscode = str.trim();
		this.initPasscode();
	}
};

bs.injectBsFunctions = function(){
	let reviewCtrl = this.reviewCtrl;
	let bs = this;

	let submitForm0 = reviewCtrl.submitForm;
	reviewCtrl.submitForm = function(){
		bs.postPortal().always( ()=> {
			submitForm0.apply( reviewCtrl, arguments);
		} );
	};
};

bs.init = async function(){
	this.loadOverrides();
	
	this.iOS = this.isIOS();

	if( this.iOS ){
		this.fix_iOS_hover();
	}

	await this.waitForPageData();
	this.Pane.init( this );

	this.initPasscode();

	if( ! this.passcode ){
		this.$otherReviews_firebase.html( "<br><br>必須輸入 passcode 才能運作。<br>請申請一個 passcode 並在上方設定<br>設定後須要重新載入頁面。" );
		this.$div_notification_icons.hide();
		this.$otherReviews_sheet.hide();
		return;
	}else{
		this.injectBsFunctions();
		this.PostingLoader.init();

		if( this.isQueryFromSheet ){
			this.queryReviewsFromSheet();
		}else{
			this.$otherReviews_sheet.hide();
		}
		if( this.isQueryFromFirebase ){
			this.queryReviewsFromFirebase();
		}else{
			this.$otherReviews_firebase.hide();
		}
	}
};

bs.Pane = {
	init( bs ){
		this.bs = bs;

		bs.$pane =  $(`
		<div id="brainStorming">
			<div class="briefing">
				<span class="versionNo">v${bs._VERSION}</span>
				※使用本script時，評分意見會傳送到server公開 
				※其他人的意見僅作參考，請為了良好的遊戲環境努力審核，獨立思考，集思廣益
			</div>
			<div class="buttons">
				<input class="T_hashtag" value="#${bs.hashID}" size="15" onClick="this.select();" readonly />
				<a class="link" onclick="bs.editPasscodeInlocalStorage()">passcode</a>
				<a class="link" target="_blank" href="https://brainstorming.azurewebsites.net/watermeter.html#${bs.hashID}"><span class="short">查</span><span class="long">水表</span></a> 
				<a class="link" target="_blank" href="https://brainstorming.azurewebsites.net/bs.html"><span class="short">牆</span><span class="long">wall</span></a> 
				<a class="link" target="_blank" href="https://docs.google.com/spreadsheets/d/e/2PACX-1vSrXYajaKHfO0aDANr-aFu61DEzB0wy5X87uQUBKFza__1J7ttnqJh_84Gvp9-tETIzjbiK_yPx7Llk/pubhtml?gid=621294114&single=true"><span class="short">統</span><span class="long">使用統計</span></a>
			</div>
			<div class="otherReviews otherReviews_firebase"> ⌛ Loading...</div> 
			<div class="otherReviews otherReviews_sheet"> ⌛ Loading...</div> 
			<div class="div_notification_icons"><span class="loading">⌛</span></div> 
		</div>
		`);
		bs.$div_notification_icons = $(".div_notification_icons", bs.$pane );
		bs.$otherReviews_firebase = $(".otherReviews_firebase", bs.$pane);
		bs.$otherReviews_sheet = $(".otherReviews_sheet", bs.$pane);

		$(document.body).append(this.css, bs.$pane );
	},
	css:`
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
	init(){
		$(document.body).append(this.css);
	},
	show(){
		$(document.body).append(this.html);
	},
	hide(){
		$(".bsPostingLoader").remove();
	},
	html:`
		<div class="bsPostingLoader">
			<img class="loader rotating" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAOUlEQVQYlWNgQAX/0TBW8P//QXYUjE0xhiJsijEkkGlkxThNo1BhuBKyIB53hiuhYrw+J0IRwQAHAArxntwkepFwAAAAAElFTkSuQmCC">
			<div class"text">posting to Brainstorming...</div>
		</div>
	`,
	css:`
		<style>
			.bsPostingLoader {
				position: absolute;
				z-index: 999;
				top: 0;
				bottom: 0;
				left: 0;
				right: 0;
				background: rgba(0,0,0,0.76);
				display: flex;
				justify-content: center;
				align-items: center;
				flex-direction: column;
			}
			.bsPostingLoader .text{
				color: white;
				margin-top:1em;
			}
			.bsPostingLoader .loader{
				width: 20vmin;
				opacity: 0.5;
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

if(!window.jQuery){
	var script = document.createElement("script");
	script.src = "https://cdn.jsdelivr.net/gh/jquery/jquery@3.5.1/dist/jquery.min.js";
	script.onload = ()=>bs.init();
	
	document.head.appendChild(script);
}else{
	bs.init();
}
