import { analyticsState, setAnalyticsEnabled } from '../analytics.js';
import { t } from '../i18n.js';

export function mount(root){
  const box = root.querySelector('#analyticsBox');
  if(!box) return;
  const say = {
    on:t('Analytics is <b>on</b>.', '使用情况分析已<b>开启</b>。'),
    off:t('Analytics is <b>off</b> — nothing is sent.', '使用情况分析已<b>关闭</b>，不会发送分析数据。'),
    dnt:t('Analytics is <b>off</b> because your browser sends a Do Not Track / Global Privacy Control signal.', '你的浏览器发送了“请勿跟踪”或“全球隐私控制”信号，使用情况分析已<b>关闭</b>。'),
    unconfigured:t('Analytics is <b>not enabled</b> in this version of Klarbase — nothing is sent.', '此版本<b>未启用</b>使用情况分析，不会发送分析数据。'),
  };
  function draw(){
    const state = analyticsState();
    box.innerHTML = `<p style="margin:0 0 6px">${say[state]}</p>${state === 'on' || state === 'off' ? `<button class="btn small">${state === 'on' ? t('Turn analytics off', '关闭分析') : t('Turn analytics on', '开启分析')}</button>` : ''}`;
    const button = box.querySelector('button');
    if(button) button.onclick = () => { setAnalyticsEnabled(state === 'off'); draw(); };
  }
  draw();
}
