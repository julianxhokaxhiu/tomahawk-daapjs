/*
 * (c) 2013 Julian Xhokaxhiu <http://julianxhokaxhiu.com>
 */
'use strict';
var DaapJSResolver = Tomahawk.extend(TomahawkResolver,{
    ready:false,
    songs:null,
    settings:
    {
        name: 'DAAP',
        icon: 'daapjs.png',
        weight: 75,
        timeout: 5
    },
    init: function(){
        var userConfig = this.getUserConfig();
        var cachedSongs = window.localStorage.getItem('DJS_songs');
        if(cachedSongs&&(this.getDaysOld()<1)){
            if(userConfig !== undefined) this.host = userConfig.host;
            Tomahawk.log('Loading the existing cache...');
            this.songs = JSON.parse(cachedSongs);
            this.ready = true;
            Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
        }else{
            if(userConfig !== undefined){
                this.host = userConfig.host;
                this.port = userConfig.port;
                this.password = userConfig.password;
                this.connectToServer();
            }
        }
    },
    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {

            "widget": uiData,
            fields: [
            {
                name: "host",
                widget: "serverEdit",
                property: "text"
            },
            {
                name: "port",
                widget: "portEdit",
                property: "text"
            },
            {
                name: "password",
                widget: "passwordEdit",
                property: "text"
            }
            ],
            images: [{
                "daapjs.png" : Tomahawk.readBase64("daapjs.png")
            }]
        };
    },
    newConfigSaved: function(){
        var userConfig = this.getUserConfig();
        if ((userConfig.host != this.host) || (userConfig.port != this.port) || (userConfig.password != this.password)){
            this.host = (userConfig.host ? userConfig.host : 'localhost');
            this.port = (userConfig.port ? userConfig.port : 3689);
            this.password = userConfig.password;
            this.saveUserConfig();
            // Connect to the server
            if(!this.ready)this.connectToServer();
        }
    },
    resolve:function(qid,artist,album,title){
        var ret = {
            qid: qid,
            results: []
        };
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                if(song['title']===title && song['artist']===artist && song['album']===album) ret.push(this.getSongItem(song));
            }
        }
        return Tomahawk.addTrackResults(ret);
    },
    search: function(qid,searchString){
        var ret = {
            qid: qid,
            results: []
        };
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i], add = false;
                if(searchString=='#ALLDAAPDB#')add=true;
                if(song['title'].toLowerCase().indexOf(searchString)>-1)add=true;
                if(song['artist'].toLowerCase().indexOf(searchString)>-1)add=true;
                if(song['album'].toLowerCase().indexOf(searchString)>-1)add=true;
                if(song['genre'].toLowerCase().indexOf(searchString)>-1)add=true;
                if(add)ret.results.push(this.getSongItem(song));
            }
        }
        Tomahawk.addTrackResults(ret);
    },

    //ScriptCollection
    artists:function(qid){
        var ret = {};
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                var key = song['artist'];
                // A better way handling duplicate keys with massive performance :)
                // Thanks to <Jonathan Sampson> from http://stackoverflow.com/questions/10757516/how-to-prevent-adding-duplicate-keys-to-a-javascript-array
                if(!(key in ret))ret[key] = 0;
            }
        }
        Tomahawk.addArtistResults({
            qid: qid,
            artists: Object.keys(ret)
        });
    },
    albums:function(qid,artist){
        var ret = {};
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                var key = song['album'];
                // A better way handling duplicate keys with massive performance :)
                // Thanks to <Jonathan Sampson> from http://stackoverflow.com/questions/10757516/how-to-prevent-adding-duplicate-keys-to-a-javascript-array
                if((song['artist']===artist) && !(key in ret))ret[key] = 0;
            }
        }
        Tomahawk.addAlbumResults({
            qid: qid,
            artist: artist,
            albums: Object.keys(ret)
        });
    },
    tracks:function(qid,artist,album){
        var ret = {};
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                var key = song['title'];
                // A better way handling duplicate keys with massive performance :)
                // Thanks to <Jonathan Sampson> from http://stackoverflow.com/questions/10757516/how-to-prevent-adding-duplicate-keys-to-a-javascript-array
                if((song['artist']===artist) && (song['album']===album) && !(key in ret))ret[key] = this.getSongItem(song);
            }
        }
        Tomahawk.addAlbumTrackResults({
            qid: qid,
            artist: artist,
            album: album,
            results: this.objectValues(ret)
        });
    },
    collection:function(){
        if(this.ready) return {
            prettyname: "DAAP",
            description: this.host,
            iconfile: "daapjs.png",
            trackcount: this.songs.length
        };
    },

    // UTILITY
    fixItem:function(item){
        var ret = 'N/A';
        if(item){
            if((typeof item) === 'string') ret = (item.length ? item : 'N/A');
            else if((typeof item) === 'number') ret = (item>0 ? item : 0);
        }
        return ret;
    },
    fixDB:function(arr){
        var _this = this;
        return arr.map(function(e){
            for(var k in e) e[k] = _this.fixItem(e[k]);
            return e;
        })
    },
    getSongItem:function(song){
        if(song) return {
            artist: song['artist'],
            album: song['album'],
            track: song['title'],
            url: song['uri'],
            bitrate:song['bitrate'],
            duration:Math.round(song['duration']/1000),
            size: song['size'],
            score: 1.0,
            extension:song['format'],
        }
    },
    connectToServer:function(){
        var _this = this;
        var client = new DaapClient(this.host,this.port);
        var loginCompleted = function(code){
            if (code == 200) {
                Tomahawk.log('Connected. Fetching your song list, it may take a while...')
                client.fetchStreams(streamsFetched);
            } else if (code == 401) {
                client.secureLogin(_this.password, loginCompleted);
            } else {
                Tomahawk.log('Could not login to the DAAP server: [HTML Status code = ' + code + ']');
            }
        };
        var streamsFetched = function(code,streams) {
            if (code == 200) {
                _this.songs = _this.fixDB(streams);
                Tomahawk.log('Ready!');
                _this.ready = true;
                Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
                window.localStorage.setItem('DJS_songs',JSON.stringify(streams));
                window.localStorage.setItem('DJS_songs_ts',new Date());
            }else Tomahawk.log('Could not fetch streams: [HTML Status code = ' + code + ']');
        };
        // start with unsecure login - no password.
        client.login(loginCompleted);
    },
    objectValues:function(obj){
        var tmp = [];
        for(var k in obj)tmp.push(obj[k]);
        return tmp;
    },
    getDaysOld:function(){
        var ret = 0;
        var cacheDate = window.localStorage.getItem('DJS_songs_ts');
        if(cacheDate){
            var diff = new Date(new Date() - cacheDate);
            if(diff.getUTCSeconds()>0) ret = diff.getUTCSeconds() / (24*60*60);
        }
        return ret;
    }
});
Tomahawk.resolver.instance = DaapJSResolver;