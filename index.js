import puppeteer from 'puppeteer';
import fs from "fs/promises";


async function main() {
    const problems = (JSON.parse(await fs.readFile('./problems.json'))).data.problemsetQuestionList.questions;
    for(const i in problems) {
        const prob = problems[i];
        console.log(i, prob.difficulty, prob.paidOnly, prob.title);
    }
}

main();