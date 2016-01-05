//====================================================================================
//     The MIT License (MIT)
//
//     Copyright (c) 2011 Kapparock LLC
//
//     Permission is hereby granted, free of charge, to any person obtaining a copy
//     of this software and associated documentation files (the "Software"), to deal
//     in the Software without restriction, including without limitation the rights
//     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//     copies of the Software, and to permit persons to whom the Software is
//     furnished to do so, subject to the following conditions:
//
//     The above copyright notice and this permission notice shall be included in
//     all copies or substantial portions of the Software.
//
//     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//     THE SOFTWARE.
//====================================================================================
(function($){
	/* use this when embed directly into the html file */
	/*
	var mainContainer = $('#'+'<@=MAIN_CONTAINER_ID@>');
	var currentElement = $('#'+'<@=CURRENT_ELEMENT_ID@>');
	var rootURL='<@=ROOT_URL@>';
	* */
	/* use this when embed directly into the html file */
	
	/* use this when using seperate JS file */
	var scriptTags = document.getElementsByTagName("script");
	var src=scriptTags[scriptTags.length-1].src;
	var mainContainerId = unescape(src).split("mainContainerId=")[1].split("&")[0];
	var rootURL = unescape(src).split("rootURL=")[1].split("&")[0];
	var mainContainer = $('#'+mainContainerId);
	
	/* use this when using seperate JS file */
	//=============================================
	// helper functions
	//=============================================
	var IE = !!/msie/i.exec( window.navigator.userAgent );
	var getStrCopy = function (str, copies) {
		var newStr = str;
		copies = (copies > 0) ? copies : 1;
		while (--copies) newStr += str;
		return newStr;
	};	
	var convertDecToBase = function ( dec, base, length, padding ) {
		padding = padding || '0' ;
		var num = dec.toString( base );
		length = length || num.length;
		if (num.length !== length) {
			if (num.length < length) num = getStrCopy( padding, (length - num.length)) + num;
			else throw new Error("convertDecToBase(): num(" + num + ").length > length(" + length + ") too long.");
		}
		return num;
	};
	var sendZDOCommand = function(cmd, param, callback) 
	{
		$.ajax({
			url: rootURL + '/api/devices/0000/endpoints/00/'+ cmd,
			data:param,
			dataType: "json",
			beforeSend: function( xhr ) 
			{
				xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
			}
			}).done(callback);
	};
	var Device = Backbone.Model.extend({
		update: function() 
		{
			$.ajax({
				url: rootURL + '/api/thisdevice',
				dataType: "json",
				beforeSend: function( xhr ) {
					xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
				}
				}).done($.proxy(function(data) {
					this.set({state:data});
				}, this));
		}
	});
	var PermitJoinBtn = Backbone.View.extend({
		events: {'click span': 'handle'},
		state: 'idle',
		interval:64,
		remaining:0,
		handle: function(e) 
		{
			e.preventDefault();
			e.stopPropagation();
			//console.log('clicked permit join button, state = ' + this.state + ', time = ' + this.remaining);
			this.remaining = 0;
			if (this.state == 'idle') {
				this.sendCommand();
			}
		},
		sendCommand: function() {
			if (this.state == 'idle') {
				sendZDOCommand('Mgmt_Permit_Joining_req', {'PermitDuration':'40', 'TC_Significance':'00'},function(ctx) {
					console.log(ctx);			
				});
				this.remaining = this.interval;
				this.state = 'open';
				this.btnMsg.html('HAN open to join, closing in T - ' + this.remaining + ' ...');
				setTimeout($.proxy(this.sendCommand,this), 1000);
			} else if (this.state == 'open') {
				if (this.remaining > 0)  
				{
					this.remaining--;
					this.btnMsg.html('HAN open to join, closing in T - ' + this.remaining + ' ...');
					setTimeout($.proxy(this.sendCommand,this), 1000);
					if (this.remaining % 8 == 0)
					{
						this.model.update();
					}
				} else {
					this.btnMsg.html('Permit Join');
					this.state = 'idle';
					sendZDOCommand('Mgmt_Permit_Joining_req', {'PermitDuration':'00', 'TC_Significance':'00'},function(ctx) {
						console.log(ctx);			
					});
				}
			} else {
				this.remaining = 0;
				this.state = 'idle';
			}
		},
		initialize: function(config) {
			_.bindAll(this, 'render', 'sendCommand','handle');

			this.button = $('<span class="btn btn-default" style="width:100%"></span>').appendTo($(this.el));
			this.btnMsg = $('<span>Permit Join</span>').appendTo(this.button);
			config['wrapper'].append(this.el);
			this.model = config['model'];
		}		
	});

	// This function displays a JSON in show/hide style
	var showObj = function(obj)
	{
		var container; 
		var type = 'simple';
		
		if ($.isPlainObject(obj) || $.isArray(obj))
		{
			type = 'complex';
			container= $('<div style="padding-left:10px;"></div>');
			$.each(obj, $.proxy( function(k,v){
				var x = showObj(v);
				if (x['type'] == 'complex') 
				{
					var topRow = $('<div class="top-row">'+ k +' </div>').appendTo(container);
					var button = $('<span class="btn btn-default show-hide">+</span>').prependTo(topRow);					
					container.append(x['container'].css('display','none').attr('class','content'));
					button.click($.proxy( function(e) {
						e.stopPropagation();
						var cont = this.content;
						var btn = this.button;
						if (cont.css('display') == 'none') 
						{
							cont.css('display','inline-block');
							btn.html('-');
						} else {
							cont.css('display','none');
							btn.html('+');
						}
					}, {button:button, content: x['container']}));
				} else {
					container.append('<div>'+ k +' : '+ v +'</div>');
				}
			},container));
		} else {
			container= $('<span>'+ obj +'</span>');
		}
		return {type:type, container:container};	
	};
	var DeviceList = Backbone.View.extend({
		ids:[],
		handle: function() 
		{
			var assocList = this.model.get('state').assocs;		
			assocList.forEach($.proxy( function(devInfo) 
			{
				//check for duplicate
				if ($.inArray(devInfo.ieee_id,this.ids) >= 0 ) 
				{
					return;
				}
				this.ids.push(devInfo.ieee_id);
				var row = $('<div class="dev-list" style="margin:10px 0px;"></div>').appendTo(this.panel).data('id', devInfo.ieee_id);
				var topRow = $('<div class="top-row"><span class="nwk-addr">0x'+ devInfo.id +'</span> </div>').appendTo(row);
				var button = $('<span class="btn btn-default show-hide">+</span>').prependTo(topRow);					
				var unlinkbtn = $('<span class="btn btn-default" style="position:relative; left:60%;">Unlink</span>').appendTo(topRow);
				var x = showObj(devInfo);				
				unlinkbtn.click($.proxy( function(e) {
					e.stopPropagation();
					sendZDOCommand('Mgmt_Leave_req', this, function(data){});
					setTimeout('location.reload()', 1500);
				}, {ieeeAddr:devInfo.ieee_id}));
			
				row.append(x['container'].css('display','none'));
				button.click($.proxy( function(e) {
						e.stopPropagation();
						var cont = this.content;
						var btn = this.button;
						if (cont.css('display') == 'none') 
						{
							cont.css('display','inline-block');
							btn.html('-');
						} else {
							cont.css('display','none');
							btn.html('+');
						}
					}, {button:button, content: x['container']}));
			},this));
		},
		initialize: function(config)
		{
			_.bindAll(this,'handle');
			$(this.el).css('overflow','auto').css('height','280px').css('white-space', 'nowrap');
			this.panel = $('<div></div>').appendTo($(this.el));
			this.model = config['model'];
			this.model.bind("change", this.handle, this);
			config['wrapper'].append(this.el);
			this.panel.append('<div style="font-weight:bold">Linked Devices</div>');
			this.model.update();
		}
	});
	var MainPanel = Backbone.View.extend({
		el:$(mainContainer),
		initialize: function()
		{
			_.bindAll(this, 'render');
			this.panel = $('<div class="wd-container"></div>').appendTo($(this.el));
			this.model = new Device;
			new PermitJoinBtn({ 
				wrapper: $('<div class="wd-row wd-content"></div>').appendTo($(this.panel)), 
				model  : this.model
			});
			new DeviceList({ 
				wrapper: $('<div class="wd-row wd-content"></div>').appendTo($(this.panel)), 
				model  : this.model
			});
		}
	 });
	var mainPanel = new MainPanel();

}(jQuery))

