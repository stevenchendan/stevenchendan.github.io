import type {Language} from './i18n';
import Icon from './Icon';
import styles from './arena.module.css';

export default function Autographs({language,visit}:{language:Language;visit:()=>void}){
  const zh=language==='zh';
  return <div className={styles.fanGuide}>
    <section><h3>{zh?'从训练村开始':'Start at the Practice Village'}</h3>
      <p>{zh?'训练村在起亚球场和约翰·凯因球场之间。出发前看澳网当天公布的练习表，记下球员、球场和时间。':'Find the practice courts between Kia Arena and John Cain Arena. Check the day’s published practice schedule for your player, court and time before heading over.'}</p>
      <button className={styles.fanVisit} onClick={visit}><Icon name="pin"/>{zh?'在模型中查看训练村':'Show Practice Village in 3D'}<Icon name="next"/></button>
      <a href="https://ausopen.com/practice-schedule" target="_blank" rel="noreferrer">{zh?'澳网官方练习日程 ↗':'Official practice schedule ↗'}</a>
    </section>
    <section><h3>{zh?'看球员通道时，站在观众侧':'Look for the public side of the player exit'}</h3>
      <p>{zh?'到场后问引导员：「今天练习结束后，观众可以在哪一侧等签名？」如果现场开放等候区，就留在护栏的观众侧，等球员结束练习、主动靠近。提前准备好一支笔和一件想签的物品。':'Ask an usher where spectators may wait after that practice. If a waiting area is open, stay on the spectator side of the rail and let the player approach after the session. Have one item and a pen ready.'}</p>
      <p>{zh?'球员通道的位置不代表该座区提供签名。球员可能直接离场，等候位置和入场要求以现场安排为准。':'An entrance near a section does not confer autograph access. Players may leave straight away, and stewards can change where fans wait.'}</p>
    </section>
    <section><h3>{zh?'另一个机会：公开见面活动':'Check for scheduled appearances'}</h3>
      <p>{zh?'查看当天的球迷活动，优先选择明确列有签名环节的场次。澳网把公开练习场列为可以合影和要签名的地点。':'Look for a signing listed in the day’s fan programme. AO also identifies public practice courts as places fans can seek photos and autographs.'}</p>
      <a href="https://ausopen.com/whats-on" target="_blank" rel="noreferrer">{zh?'2027 澳网球迷活动 ↗':'AO 2027 fan programme ↗'}</a>
      <a href="https://ausopen.com/digitalmap" target="_blank" rel="noreferrer">{zh?'澳网官方园区地图 ↗':'AO precinct map ↗'}</a>
      <a href="https://ausopen.com/articles/news/how-get-best-value-tickets-ao-2026" target="_blank" rel="noreferrer">{zh?'澳网观赛指南 · 2026 ↗':'AO fan guide · 2026 ↗'}</a>
    </section>
  </div>;
}
