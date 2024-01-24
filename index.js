import puppeteer from "puppeteer-extra";
import fs from "fs/promises";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import got from "got";

puppeteer.use(StealthPlugin());
const sol = JSON.parse(await fs.readFile("./solution.json", "utf-8"));
const topic = JSON.parse(await fs.readFile("./topic.json", "utf-8"));

async function main() {
  if(!process.argv[2] || !process.argv[3]) return console.error("Missing username or password! Usage: node index <username> <password> <start index>")
  const broswer = await puppeteer.launch({ headless: false });
  await login(process.argv[2], process.argv[3], broswer);
  let start = parseInt(process.argv[4]) || 0;
  if(start < 0) start = 0;
  const problems = JSON.parse(await fs.readFile("./problems.json")).data
    .problemsetQuestionList.questions;
  for (const i in problems) {
    const prob = problems[i];
    console.log(i, prob.difficulty, prob.paidOnly, prob.title);
    if(i < start) continue;
    if (prob.paidOnly) {
      console.log("Skipping paid problem!");
      continue;
    }
    await solver(prob.frontendQuestionId, prob.titleSlug, broswer);
  }
}

// document.querySelector('.CodeMirror').CodeMirror.setValue('VALUE')

function login(username, password, broswer) {
  return new Promise(async (resolve, reject) => {
    try {
      const page = await broswer.newPage();
      await blockImages(page);
      await page.goto("https://leetcode.com/accounts/login/", {
        waitUntil: "networkidle0",
      });
      await sleep(1000);
      await page.click("#id_login");
      await input(page, username);
      await page.click("#id_password");
      await input(page, password);
      await page.click("#signin_btn");
      await page.waitForNavigation();
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function solver(id, title, broswer) {
  return new Promise(async (resolve, reject) => {
    const url = "https://leetcode.com/problems/" + title;
    console.log(url);
    try {
      const page = await broswer.newPage();
      await blockImages(page);
      await page.goto(url, { waitUntil: "networkidle0" });
      await sleep(5000);
      let answer = await getSolutionPost(id)
      console.log(answer);
      answer = answer.replaceAll("\\n", "\n");
      answer = answer.replaceAll("\\t", "\t");
      console.log(answer);
      await page.evaluate((answer) => {
        document.querySelector('.CodeMirror').CodeMirror.setValue(answer)
      }, answer)
      await page.click(".submit__2ISl");
      await page.waitForNetworkIdle({idleTime: 5000})
      await page.close();
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function getSolutionPost(quesID) {
  return new Promise(async (resolve, reject) => {
    try {
      sol.variables.questionId = quesID;
      const data = await gqlRequest(sol);
      const id = data.data.questionTopicsList.edges[0].node.id;
      console.log(id);
      topic.variables.topicId = id;
      const postData = await gqlRequest(topic);
      const post = postData.data.topic.post.content;
      resolve(parsePost(post));
    } catch (e) {
      reject(e);
    }
  });
}

function parsePost(postMD) {
  let splitted = postMD.split("```");
  if (splitted.length == 1) splitted = postMD.split("`");
  for (const i of splitted) {
    if (i.includes("class Solution {")) return "class Solution {" + cutString(i, "class Solution {");
  }
}

function cutString(inputString, substring) {
  const index = inputString.indexOf(substring);
  const startIndex = index + substring.length;
  const result = inputString.slice(startIndex);
  return result;
}

function gqlRequest(json) {
  return new Promise(async (resolve, reject) => {
    try {
      const { body, statusCode } = await got.post(
        "https://leetcode.com/graphql",
        {
          json,
        }
      );
      if (statusCode !== 200 || body.error) {
        throw new Error(
          body.error || "Oops. Something went wrong! Try again please."
        );
      }
      resolve(JSON.parse(body));
    } catch (e) {
      reject(e);
    }
  });
}

function blockImages(page) {
  return new Promise(async (resolve, reject) => {
    try {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.resourceType() === "image") {
          request.abort();
        } else {
          request.continue();
        }
      });
      const session = await page.target().createCDPSession();
      await session.send("Page.enable");
      await session.send("Page.setWebLifecycleState", { state: "active" });
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function input(
  page,
  str,
  keyMin = 100,
  keyMax = 200,
  pressMin = 50,
  pressMax = 150
) {
  return new Promise(async (res) => {
    for (const i of str) {
      const pressDelay = randomInt(pressMin, pressMax);
      const delayKey = randomInt(keyMin, keyMax);
      page.keyboard.type(i, { delay: pressDelay });
      await sleep(delayKey);
    }
    res();
  });
}

function sleep(time) {
  return new Promise((r) => setTimeout(r, time));
}

function randomInt(min = 0, max = 1) {
  return Math.floor(Math.random() * (max - min) + min);
}
main();
