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

    var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45', gray = '555555';
    var imdb_color = orange;
    var kinopoisk_color = orange;

    function colorStr(str, color) {
        return '<font color="' + color + '"> (' + str + ')</font>';
    }

    function coloredStr(str, color) {
        return '<font color="' + color + '">' + str + '</font>';
    }

    function checkUrl(url) {
        return url.substr(0, 4) == 'http' ? url : BASE_URL + url
    }
    function trim(s) {
        return s.replace(/(\r\n|\n|\r)/gm, "").replace(/(^\s*)|(\s*$)/gi, "").replace(/[ ]{2,}/gi, " ");
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
                    postdata: {
                        username: credentials.username,
                        password: credentials.password,
                        returnto: ''
                    }
                }).toString();
                page.loading = false;
				//showtime.print(resp);
                
				resp = resp.match(/<input class=buttonS/);

				//showtime.print(resp);
                if (resp === null) logged = true;
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
        // 1-filelink, 2-title, 3-image
        //var re = /<tr class="[gai|tum]+"><td>([\s\S]*?)<\/td>[\s\S]*?href="([\s\S]*?)"[\s\S]*?<a href[\s\S]*?<a href="([\s\S]*?)">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
        var re = /<a href='([\s\S]*?)' title='([\s\S]*?)'[\s\S]*?<img src='([\s\S]*?)'[\s\S]*?<\/a>/g;
        var match = re.exec(doc);
        while (match) {
            var url = BASE_URL + match[1];
            page.appendItem(plugin.getDescriptor().id + ':index:' + escape(BASE_URL + match[1]), 'video', {
                title: new showtime.RichText(match[2]),
                icon: checkUrl(match[3])
            });
            //page.entries++;
            match = re.exec(doc);
        }
    }

    function scraper_search(page, url, title, paginator) {
        page.entries = 0;
        var fromPage = 0, tryToSearch = true;
        // 1-icon, 2-filelink, 3-title, 4-size
        //var re = /<tr class="[gai|tum]+"><td>([\s\S]*?)<\/td>[\s\S]*?href="([\s\S]*?)"[\s\S]*?<a href[\s\S]*?<a href="([\s\S]*?)">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
        var re = /<img src="([\s\S]*?)"[\s\S]*?<td class="nam"><a href="([\s\S]*?)"[\s\S]*?>([\s\S]*?)<\/a><td class='s'>[\s\S]*?<td class='s'>([\s\S]*?)<\/td>/g;

        function loader() {
            if (!tryToSearch) return false;
            page.loading = true;
            var doc;
            if (paginator == '1')
                doc = showtime.httpReq(unescape(url) + fromPage).toString();
            else
                doc = showtime.httpReq(unescape(url)).toString();
            page.loading = false;
            var doc1 = doc.match(/<table class="t_peer w100p"[\s\S]*?<\/table>/);
            var match = re.exec(doc1);
            while (match) {
                page.appendItem(plugin.getDescriptor().id + ':index:' + escape(checkUrl(match[2])), 'video', {
                title: new showtime.RichText(match[3]+' '+colorStr(match[4], orange)),
                icon: checkUrl(match[1])
                });
                page.entries++;
              
                match = re.exec(doc1);
            };
            if (!doc.match(/<table class="t_peer w100p"[\s\S]*?<a href="/)) return tryToSearch = false;
            fromPage++;
            //showtime.print(fromPage);
            loader();
        };
        loader();
        //page.paginator = loader;
        if (page.entries == 0)
            page.error("По заданному запросу ничего не найдено");
        page.loading = false;
    }


    // Index page
    plugin.addURI(plugin.getDescriptor().id + ":index:(.*)", function(page, url) {
        login(page, false);
        page.loading = true;
        response = showtime.httpReq(unescape(url)).toString();
        var title = trim(response.match(/<h1><a href="[\s\S]*?>([\s\S]*?)<\/a>/)[1]);
        setPageHeader(page, title);
        var description = response.match(/<div class="bx1 justify"><p><b>[\s\S]*?<\/b>([\s\S]*?)<\/p>/);
        if(description)description = trim(description[1]);

        var origtitle = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>Оригинальное название:<\/b>([\s\S]*?)<br/);
        if(origtitle){
            origtitle = trim(origtitle[1]);
            title = title+' | '+origtitle;
        }

        var year = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>Год выпуска:<\/b>([\s\S]*?)<br/);
        if(year)year = trim(year[1]);

        var genre = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>Жанр:<\/b>([\s\S]*?)<br/);
        if(genre)genre = trim(genre[1]);

        var vipusk = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>Выпущено:<\/b>([\s\S]*?)<br/);
        if(vipusk)vipusk = trim(vipusk[1]);

        var regisor = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>Режиссер:<\/b>([\s\S]*?)<br/);
        if(regisor)regisor = trim(regisor[1]).replace(/<\/?[^>]+>/gi, '');

        var actors = response.match(/<div class="bx1 justify"><h2>[\s\S]*?<b>В ролях:<\/b>([\s\S]*?)<br/);
        if(actors)actors = trim(actors[1]).replace(/<\/?[^>]+>/gi, '');


        var quality = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Качество:<\/b>([\s\S]*?)<br/);
        if(quality)quality = trim(quality[1]);

        var video = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Видео:<\/b>([\s\S]*?)<br/);
        if(video)video = trim(video[1]);

        var audio = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Аудио:<\/b>([\s\S]*?)<br/);
        if(audio)audio = trim(audio[1]);

        var size = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Размер:<\/b>([\s\S]*?)<br/);
        if(size)size = trim(size[1]);

        var duration = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Продолжительность:<\/b>([\s\S]*?)<br/);
        if(duration)duration = trim(duration[1]);

        var language = response.match(/<div[\s\S]*?id="tabs">[\s\S]*?<b>Язык:<\/b>([\s\S]*?)<\/div>/);
        if(language)language = trim(language[1]);
        
        var imdb = response.match(/<li><span class="bulet">[\s\S]*?IMDb<span class="floatright">([\s\S]*?)<\/span>/);
        if(imdb)imdb = trim(imdb[1]);

        var kinopoisk = response.match(/<li><span class="bulet">[\s\S]*?Кинопоиск<span class="floatright">([\s\S]*?)<\/span>/);
        if(kinopoisk)kinopoisk = trim(kinopoisk[1]);

        var image = response.match(/<li class="img"><a href[\s\S]*?<img src="([\s\S]*?)"[\s\S]*?<\/a>/);
        if(image)image = trim(image[1]);

        var cat_image = response.match(/<img src="([\s\S]*?)" class="cat_img_r"/);
        if(cat_image)cat_image = trim(cat_image[1]);

        var link = response.match(/<table[\s\S]*?class="w100p"[\s\S]*?<a href="([\s\S]*?)"[\s\S]*?<img/);
        if(link)link = trim(link[1]);

        if(!logged)
        page.appendItem("", "separator", {
                title: new showtime.RichText(coloredStr('Если видео не проигрывается - залогиньтесь в настройках плагина', red))
            });

        page.appendItem("", "separator", {
                title: new showtime.RichText(coloredStr('СМОТРЕТЬ', blue))
            });
        page.appendItem('torrent:browse:' + checkUrl(link), "directory", {
            icon: checkUrl(image),
            title: new showtime.RichText(colorStr(quality, orange) + ' ' + title+colorStr(year, green))
        });

        page.appendItem("", "separator", {
                title: new showtime.RichText(coloredStr('ИНФОРМАЦИЯ', blue))
            });

        page.appendPassiveItem('video', {}, {
                title: new showtime.RichText(origtitle || title),
                icon: checkUrl(image),
                year: +year,
                genre: genre,
                duration: duration,
                rating: (imdb||kinopoisk)*10,
                description: new showtime.RichText(coloredStr('Выпущено: ', gray)+vipusk+"\n\n"+coloredStr('Режиссер: ', gray)+
                    regisor+"\n\n"+coloredStr('В ролях: ', gray)+actors+"\n\n"+coloredStr('Описание: ', gray)+description)
            });

         page.appendItem("", "separator", {
                title: new showtime.RichText(coloredStr('ТЕХ. ДАННЫЕ', blue))
            });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Качество: ', gray) + coloredStr(quality||'', orange)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Видео: ', gray) + coloredStr(video||'', orange)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Аудио: ', gray) + coloredStr(audio||'', orange)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Размер: ', gray) + coloredStr(size||'', orange)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Продолжительность: ', gray) + coloredStr(duration||'', orange)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Язык: ', gray) + coloredStr(language||'', orange)),
            icon:''
        });


        

        page.appendItem("", "separator", {
                title: new showtime.RichText(coloredStr('РЕЙТИНГ', blue))
            });

        if(parseFloat(imdb)<5)imdb_color=red;
        else if(parseFloat(imdb)>7)imdb_color=green;

        if(parseFloat(kinopoisk)<5)kinopoisk_color=red;
        else if(parseFloat(kinopoisk)>7)kinopoisk_color=green;

        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('IMDB: ', blue) + coloredStr(imdb||'', imdb_color)),
            icon:''
        });
        page.appendPassiveItem('', {}, {
            title: new showtime.RichText(coloredStr('Кинопоиск: ', blue) + coloredStr(kinopoisk||'', kinopoisk_color)),
            icon:''
        });



        page.loading = false;
    });

    plugin.addURI(plugin.getDescriptor().id + ":list:(.*):(.*)", function(page, url, title){
        setPageHeader(page, plugin.getDescriptor().synopsis);
        page.model.contents = 'grid';
        page.loading = true;
        var doc = showtime.httpReq(BASE_URL + '/top.php', {
            args:{
                'w': url
            }
        }).toString();

        doc = doc.match(/<div class='mn1_content'>([\s\S]*?)<div class='bx2_0'>/);
        
        if (doc) {
            page.appendItem("", "separator", {
               title: title
            });
            scraper(page, doc);
        }
        page.loading = false;
    });

    plugin.addURI(plugin.getDescriptor().id + ":start", function(page) {
        setPageHeader(page, plugin.getDescriptor().synopsis);
        page.model.contents = 'grid';
        page.loading = false;
        page.appendItem(plugin.getDescriptor().id + ':list::Топ раздач' , 'directory', {
            title: 'Топ раздач'
        });
        page.appendItem(plugin.getDescriptor().id + ':list:1:Топ раздач недели' , 'directory', {
            title: 'Топ раздач недели'
        });
        page.appendItem(plugin.getDescriptor().id + ':list:2:Топ раздач месяца' , 'directory', {
            title: 'Топ раздач месяца'
        });
        page.appendItem(plugin.getDescriptor().id + ':list:3:Топ раздач 3 месяца' , 'directory', {
            title: 'Топ раздач 3 месяца'
        });
    });

    plugin.addSearcher(plugin.getDescriptor().id, logo, function(page, query) {
        
        scraper_search(page, escape(BASE_URL + '/browse.php?s=' + encodeURI(query) + '&page='), plugin.getDescriptor().id, 1);
    });

    
})(this);