"use strict";

// Common Chinese names with 100 distinct full names and 100 distinct given names.
// Keep this list shared by both generators so HTML, PDF and manifests stay aligned.
const RESUME_NAMES = Object.freeze([
  "王子轩", "李雨泽", "张宇航", "刘浩然", "陈俊杰",
  "杨志强", "黄建华", "赵国庆", "吴永强", "周海涛",
  "徐晓峰", "孙明辉", "马振华", "朱俊峰", "胡文杰",
  "郭子豪", "何嘉豪", "高一凡", "林晨曦", "罗心怡",
  "郑欣怡", "梁可馨", "谢梓萱", "宋梦瑶", "唐雨欣",
  "许佳琪", "韩诗琪", "冯雅静", "邓晓燕", "曹海燕",
  "彭春霞", "曾丽娟", "田秀兰", "董桂芳", "潘玉梅",
  "袁秋菊", "蔡冬梅", "蒋淑芬", "余淑珍", "于惠芳",
  "王丽华", "李秀华", "张玉珍", "刘金凤", "陈凤英",
  "杨兰英", "黄秀珍", "赵志伟", "吴春生", "周学军",
  "徐卫军", "孙明亮", "马国华", "朱永刚", "胡文涛",
  "郭志刚", "何海峰", "高立新", "林卫东", "罗长江",
  "郑德明", "梁晓东", "谢文轩", "宋心妍", "唐梦琪",
  "许子航", "韩思雨", "冯佳慧", "邓雨婷", "曹雅琪",
  "彭欣妍", "曾梦洁", "田佳敏", "董志鹏", "潘俊豪",
  "袁文浩", "蔡宇轩", "蒋俊宇", "余明宇", "于泽轩",
  "王嘉诚", "李志诚", "张金龙", "刘玉龙", "陈春玲",
  "杨丽娜", "黄晓红", "赵芳芳", "吴婷婷", "周丹丹",
  "徐倩倩", "孙晨阳", "马子健", "朱嘉乐", "胡雨琪",
  "郭思敏", "何欣桐", "高文静", "林佳丽", "罗海波",
]);

const fullNames = new Set(RESUME_NAMES);
const givenNames = RESUME_NAMES.map((name) => name.slice(1));
if (RESUME_NAMES.length !== 100) {
  throw new Error(`Expected 100 resume names, received ${RESUME_NAMES.length}`);
}
if (fullNames.size !== RESUME_NAMES.length) {
  throw new Error("Resume full names must be unique");
}
if (new Set(givenNames).size !== RESUME_NAMES.length) {
  throw new Error("Resume given names must be unique");
}

function candidateEmail(sequence) {
  return `candidate${String(sequence).padStart(2, "0")}@example.com`;
}

module.exports = {
  RESUME_NAMES,
  candidateEmail,
};
