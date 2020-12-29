import fs from 'fs';
import superagent from 'superagent';
import cheerio from 'cheerio';
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import { fetchJSON } from './utils';

const email = process.env['EMAIL'];
const password = process.env['PASSWORD'];

const BASEURL = 'https://account.altvr.com';

export type PortalItem = {
    thumbnailUri: string;
    spaceId: string;
    name: string;
};

export type PagerItem = {
    text: string,
    url: string
};

export class AltVRPortalCrawler{
    constructor(){
    }

    public async searchPortals(keyword: string){
        let token = await this.getToken();
        let cookie = await this.login(token);
        if (keyword.length < 2){ return {items: [], pager: []}; }
        let relativePath = `/worlds/search?q=${keyword}`
        let url = `${BASEURL}${relativePath}`;
        let text = await this.getPage(url, cookie);
        return this.parseText(text);
    }

    private async getToken(){
        let url = "https://account.altvr.com/users/sign_in";
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            "content-type": "application/x-www-form-urlencoded",
        };
        return new Promise<string>(function(resolve, reject) {
            superagent.get(url).set(headers).end(function (err, response) {
                if (err) {reject}
                let $ = cheerio.load(response.text);
                resolve($("meta[name=csrf-token]").attr('content') as string);
            });
        });
    }

    private async login(token: string){
        let url = "https://account.altvr.com/users/sign_in";
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            "content-type": "application/x-www-form-urlencoded",
        };
        return new Promise<string[]>(function(resolve, reject) {
            superagent.post(url)
            .set(headers).send({
                'utf8': '✓',
                'user[tz_offset]': '-480',
                'user[remember_me]': '1',
                'authenticity_token': token,
                'user[email]': email,
                'user[password]': password,
            }).redirects(0).end(function (err, response) {
                if (err) {reject}
                let cookie: string[] = response.headers["set-cookie"];
                resolve(cookie);
            });
        });
    }

    private async getPage(url: string, cookie: string[]){
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };

        return new Promise<string>(function(resolve, reject) {
            superagent.get(url).set({Cookie: cookie}).set(headers).end(function (err, response) {
                if (err) {reject}
                resolve(response.text);
            });
        });
    }

    private parseText(text: string){
        let items: PortalItem[] = [];
        let pager: PagerItem[] = [];

        var $ = cheerio.load(text);
        $("div.asvr-section div.content-block").each((i,e) => {
            let label = $(e).find('a.block-link').attr('aria-label');
            let name = label ? label : '';
            let href = $(e).find('a.block-link').attr('href');
            let spaceId = href ? (href.split('/').pop() as string) : '';
            let src = $(e).find('div.image-wrapper img').attr('src');
            let thumbnailUri = src ? src : '';
            let it = { 
                name,
                spaceId,
                thumbnailUri
            };
            items.push(it);
        });

        var $ = cheerio.load(text);
        $("ul.pagination a").each((i,e) => {
            let relativePath = $(e).attr('href');
            let url = `${BASEURL}${relativePath}`;
            let text = $(e).text();
            let it = {
                text,
                url
            }
            pager.push(it);
        });
        return {items, pager};
    }
}

// (async ()=>{
//     let crawler = new AltVRPortalCrawler();
//     let ret = await crawler.searchPortals('hello');
//     console.log(JSON.stringify(ret, null, 4));
// })();