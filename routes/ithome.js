const Router = require("koa-router");
const itHomeRouter = new Router();
const axios = require("axios");
const cheerio = require("cheerio");
const { get, set, del } = require("../utils/cacheData");

// 接口信息
const routerInfo = {
  name: "ithome",
  title: "IT之家",
  subtitle: "热榜",
};

// 缓存键名
const cacheKey = "itHomeData";

// 调用时间
let updateTime = new Date().toISOString();

// 调用路径
const url = "https://m.ithome.com/rankm/";


// it之家特殊处理 - url
const replaceLink = (url) => {
  const match = url.match(/[html|live]\/(\d+)\.htm/)[1];
  return `https://www.ithome.com/0/${match.slice(0, 3)}/${match.slice(3)}.htm`;
};

// 数据处理
const getData = (data) => {
  if (!data) return false;
  const dataList = [];
  const $ = cheerio.load(data);
  try {
    let rankParent = $("div[class=rank]");
    let allRank = $(rankParent).find("div[class=rank-name]");
    let rankLen = allRank.length;
    for (let i = 0; i < rankLen; i++) {
      const type = $(allRank[i]).data("rank-type");
      const rankBox = $(allRank[i]).next();
      let allPlaceholder = $(rankBox).children(".placeholder");
      let dataLen = allPlaceholder.length;
      for (let j = 0; j < dataLen; j++) {
        let content = $(allPlaceholder[j]);
        dataList.push({
          title: content.find(".plc-title").text(),
          img: content.find("img").attr("data-original"),
          time: content.find(".post-time").text(),
          type: content.text(),
          typeName: type,
          hot: Number(content.find(".review-num").text().replace(/\D/g, "")),
          url: replaceLink(content.find("a").attr("href")),
          mobileUrl: content.find("a").attr("href"),
        });
      }
      // dataList[type] = {
      //   name: $(this).text(),
      //   total: newsList.length,
      //   list: newsList,
      // };
    }

    return dataList;
  } catch (error) {
    console.error("数据处理出错" + error);
    return false;
  }
};

// IT之家热榜
itHomeRouter.get("/ithome", async (ctx) => {
  console.log("获取IT之家热榜");
  try {
    // 从缓存中获取数据
    let data = await get(cacheKey);
    const from = data ? "cache" : "server";
    if (!data) {
      // 如果缓存中不存在数据
      console.log("从服务端重新获取IT之家热榜");
      // 从服务器拉取数据
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" }, //设置header信息
      });
      data = getData(response.data);
      updateTime = new Date().toISOString();
      if (!data) {
        ctx.body = {
          code: 500,
          ...routerInfo,
          message: "获取失败",
        };
        return false;
      }
      // 将数据写入缓存
      await set(cacheKey, data);
    }
    ctx.body = {
      code: 200,
      message: "获取成功",
      ...routerInfo,
      from,
      total: data.length,
      updateTime,
      data,
    };
  } catch (error) {
    console.error(error);
    ctx.body = {
      code: 500,
      ...routerInfo,
      message: "获取失败",
    };
  }
});

// IT之家热榜 - 获取最新数据
itHomeRouter.get("/ithome/new", async (ctx) => {
  console.log("获取IT之家热榜 - 最新数据");
  try {
    // 从服务器拉取最新数据
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" }, //设置header信息
    });
    const newData = getData(response.data);
    updateTime = new Date().toISOString();
    console.log("从服务端重新获取IT之家热榜");

    // 返回最新数据
    ctx.body = {
      code: 200,
      message: "获取成功",
      ...routerInfo,
      updateTime,
      total: newData.length,
      data: newData,
    };

    // 删除旧数据
    await del(cacheKey);
    // 将最新数据写入缓存
    await set(cacheKey, newData);
  } catch (error) {
    // 如果拉取最新数据失败，尝试从缓存中获取数据
    console.error(error);
    const cachedData = await get(cacheKey);
    if (cachedData) {
      ctx.body = {
        code: 200,
        message: "获取成功",
        ...routerInfo,
        total: cachedData.length,
        updateTime,
        data: cachedData,
      };
    } else {
      // 如果缓存中也没有数据，则返回错误信息
      ctx.body = {
        code: 500,
        ...routerInfo,
        message: "获取失败",
      };
    }
  }
});

itHomeRouter.info = routerInfo;
module.exports = itHomeRouter;
