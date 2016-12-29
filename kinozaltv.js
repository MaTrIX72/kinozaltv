/**
 * kinozal.tv plugin for Movian Media Center
 *
 *  Copyright (C) 2015 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

(function(plugin) {
	var BASE_URL = 'http://kinozal.tv';
    var logo = plugin.path + "logo.png";
	var logged = false, credentials;

    var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';

    function colorStr(str, color) {
        return '<font color="' + color + '"> (' + str + ')</font>';
    }

    function coloredStr(str, color) {
        return '<font color="' + color + '">' + str + '</font>';
    }

    function setPageHeader(page, title) {
        if (page.metadata) {
            page.metadata.title = showtime.entityDecode(title);
            page.metadata.logo = logo;
        }
        page.type = "directory";
        page.contents = "items";
        if (!logged)
            login(page, false);
        page.loading = true;
    }
	
	function login(page, showDialog) {
        var text = '';
        if (showDialog) {
           text = 'Введите email и пароль';
           logged = false;
        }

        if (!logged) {
            credentials = plugin.getAuthCredentials(plugin.getDescriptor().synopsis, text, showDialog);
            if (credentials && credentials.username && credentials.password) {
                var params = 'username=' + credentials.username + '&password=' + credentials.password + '&returnto';
                page.loading = true;
                var resp = showtime.httpReq(BASE_URL+ '/takelogin.php', {
                    args: {
                        username: credentials.username,
                        password: credentials.password,
                        returnto: ''
                    }
                }).toString();
                page.loading = false;
				
				resp = resp.match(/<input class="buttonS"/);
				if(resp){
					showtime.message(resp[0], true, false);
				}
                if (resp == '') logged = true;
            }
        }

        if (showDialog) {
           if (logged) showtime.message("Вход успешно произведен. Параметры входа сохранены.", true, false);
           else showtime.message("Не удалось войти. Проверьте email/пароль...", true, false);
        }
    }

    var service = plugin.createService(plugin.getDescriptor().title, plugin.getDescriptor().id + ":start", "video", true, logo);

    var settings = plugin.createSettings(plugin.getDescriptor().id, logo, plugin.getDescriptor().synopsis);
    settings.createAction('kinozaltv_login', 'Войти в kinozal.tv', function() {
        login(0, true);
    });


    function scraper(page, doc) {
        // 1-date, 2-filelink, 3-infolink, 4-title, 5-(1)size, (2)seeds, (3)peers
        var re = /<tr class="[gai|tum]+"><td>([\s\S]*?)<\/td>[\s\S]*?href="([\s\S]*?)"[\s\S]*?<a href[\s\S]*?<a href="([\s\S]*?)">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
        var match = re.exec(doc);
        while (match) {
            if (match[5].match(/alt="C"/)) {
                var end = match[5].match(/[\s\S]*?<td align="right">[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
                var comments = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)</)[1];
            } else
                var end = match[5].match(/[\s\S]*?<td align="right">([\s\S]*?)<[\s\S]*?nbsp;([\s\S]*?)<\/span>[\s\S]*?nbsp;([\s\S]*?)<\/span>/);
            var url = service.baseURL + match[2];
            if (match[2].match(/http:\/\//))
                url = service.baseURL + match[2].match(/(\/download.*)/)[1];
            page.appendItem('torrent:browse:' + url, "directory", {
                title: new showtime.RichText(colorStr(match[1], orange) + ' ' +
                    match[4] + ' ('+ coloredStr(end[2], green) + '/'+
                    coloredStr(end[3], red) + ') ' + colorStr(end[1], blue) +
                    (comments ? colorStr(comments, orange) : ''))
            });
            page.entries++;
            match = re.exec(doc);
        }
    }

    plugin.addURI(plugin.getDescriptor().id + ":start", function(page) {
        setPageHeader(page, plugin.getDescriptor().synopsis);
        page.loading = true;
        var doc = showtime.httpReq(service.baseURL + '/top.php').toString();
        doc = doc.match(/<div class="mn1_content">([\s\S]*?)<div class="bx2_0">/);
        if (doc) {
           var re = /<div class="bx1 stable">([\s\S]*?)<\/div>/g;
           var match = re.exec(doc[1]);
           while (match) {
               page.appendItem("", "separator", {
 	           title: 'Топ раздач'
               });
               scraper(page, match[1]);
               match = re.exec(doc[1]);
           }
        }
        page.loading = false;
    });

    plugin.addSearcher(plugin.getDescriptor().id, logo, function(page, query) {
	page.entries = 0;
	var fromPage = 0, tryToSearch = true;
	
	function loader() {
            if (!tryToSearch) return false;
            page.loading = true;
	    var doc = showtime.httpReq(service.baseURL + "/search/"+ fromPage +"/0/000/0/" + query.replace(/\s/g, '\+')).toString();
	    page.loading = false;
            scraper(page, doc);
	    if (!doc.match(/downgif/)) return tryToSearch = false;
            fromPage++;
	    return true;
	};
	loader();
	page.paginator = loader;
      });
})(this);