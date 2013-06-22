/*
 * (c) 2013 Julian Xhokaxhiu <http://julianxhokaxhiu.com>
 */

var DaapJSResolver = Tomahawk.extend(TomahawkResolver,{
    ready:false,
    songs:null,
    settings:
    {
        name: 'DAAPjs',
        icon: 'icon.png',
        weight: 75,
        timeout: 5
    },
    init: function(){
        var userConfig = this.getUserConfig();
        var cachedSongs = window.localStorage.getItem('DJS_songs');
        if(cachedSongs){
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
            ]
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
                if(song['title']==title && song['artist']==artist && song['album']==album)ret.push(this.getSongItem(song));
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
                if(song['title'].toLowerCase().indexOf(searchString)!=-1)add=true;
                if(song['artist'].toLowerCase().indexOf(searchString)!=-1)add=true;
                if(song['album'].toLowerCase().indexOf(searchString)!=-1)add=true;
                if(song['genre'].toLowerCase().indexOf(searchString)!=-1)add=true;
                if(add)ret.results.push(this.getSongItem(song));
            }
        }
        Tomahawk.addTrackResults(ret);
    },

    //ScriptCollection
    artists:function(qid){
        var ret = {
            qid: qid,
            artists: []
        };
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                if(!this.inArray(song['artist'],ret.artists))ret.artists.push(song['artist']);
            }
        }
        Tomahawk.addArtistResults(ret);
    },
    albums:function(qid,artist){
        var ret = {
            qid: qid,
            artist: artist,
            albums: []
        };
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                if((song['artist']==artist) && (!this.inArray(song['album'],ret.albums)))ret.albums.push(song['album']);
            }
        }
        Tomahawk.addAlbumResults(ret);
    },
    tracks:function(qid,artist,album){
        var ret = {
            qid: qid,
            artist: artist,
            album: album,
            results: []
        };
        if(this.ready){
            var len = this.songs.length;
            for(var i = 0; i < len; i++){
                var song = this.songs[i];
                if((song['artist']==artist) && (song['album']==album) && (!this.inArray(song['title'],ret.results)))ret.results.push(song['title']);
            }
        }
        Tomahawk.addAlbumTrackResults(ret);
    },
    collection:function(){
        if(this.ready) return {
            prettyname: "DAAPjs",
            description: '',
            iconfile: "icon.png",
            trackcount: this.songs.length
        };
    },

    // UTILITY
    getSongItem:function(song){
        if(song) return {
            artist: song['artist'],
            album: song['album'],
            track: song['title'],
            url: song['uri'],
            bitrate:song['bitrate'],
            duration:(song['duration']/1000),
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
                _this.songs = streams;
                Tomahawk.log('Ready!');
                _this.ready = true;
                Tomahawk.reportCapabilities(TomahawkResolverCapability.Browsable);
                window.localStorage.setItem('DJS_songs',JSON.stringify(streams));
            }else Tomahawk.log('Could not fetch streams: [HTML Status code = ' + code + ']');
        };
        // start with unsecure login - no password.
        client.login(loginCompleted);
    },
    inArray:function(needle,haystack){
        return (haystack.indexOf(needle) > -1)
    }
});
Tomahawk.resolver.instance = DaapJSResolver;