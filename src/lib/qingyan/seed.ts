import { frameDemo } from "./frame-demo";
import type { Bank, Chapter, Library, QType, Question } from "./types";
import { emptyLibrary } from "./types";

const NOW = "2026-11-01T08:00:00.000Z";

interface Row {
  id: string;
  ch: string;
  type: QType;
  stem: string;
  choices?: string[];
  answer: string[];
  explain: string;
  hard?: 1 | 2 | 3;
  tags?: string[];
}

function bundle(spec: {
  id: string;
  name: string;
  subject: string;
  description: string;
  rows: Row[];
}): { bank: Bank; chapters: Chapter[]; questions: Question[] } {
  const chapterNames: string[] = [];
  for (const row of spec.rows) {
    if (!chapterNames.includes(row.ch)) chapterNames.push(row.ch);
  }
  const chapters: Chapter[] = chapterNames.map((name, order) => ({
    id: `${spec.id}_${order}`,
    bankId: spec.id,
    name,
    order,
  }));
  const chapterId = new Map(chapters.map((chapter) => [chapter.name, chapter.id]));
  const questions: Question[] = spec.rows.map((row) => {
    const choices =
      row.type === "judge"
        ? [
            { id: "T", text: "正确" },
            { id: "F", text: "错误" },
          ]
        : (row.choices ?? []).map((text, index) => ({
            id: String.fromCharCode(97 + index),
            text,
          }));
    const answer =
      row.type === "single" || row.type === "multi"
        ? row.answer.map((letter) => String.fromCharCode(letter.toLowerCase().charCodeAt(0)))
        : row.answer;
    return {
      id: row.id,
      bankId: spec.id,
      chapterId: chapterId.get(row.ch) ?? chapters[0]!.id,
      type: row.type,
      stem: row.stem,
      choices,
      answer,
      explanation: row.explain,
      difficulty: row.hard ?? 2,
      tags: row.tags ?? [],
      source: "青砚示例",
    };
  });
  return {
    bank: {
      id: spec.id,
      name: spec.name,
      subject: spec.subject,
      description: spec.description,
      createdAt: NOW,
      updatedAt: NOW,
    },
    chapters,
    questions,
  };
}

const network = bundle({
  id: "bank_net",
  name: "计算机网络",
  subject: "网络",
  description: "路由、传输与应用层里最常考的判断。适合顺序刷完再随机抽查。",
  rows: [
    {
      id: "q_net_01",
      ch: "网络层",
      type: "single",
      stem: "OSPF 属于哪一类路由协议？",
      choices: ["距离矢量", "链路状态", "路径矢量", "应用层网关"],
      answer: ["B"],
      explain: "OSPF 基于链路状态算法，路由器交换 LSA 并各自计算最短路径树。RIP 才是距离矢量，BGP 是路径矢量。",
      tags: ["OSPF"],
    },
    {
      id: "q_net_02",
      ch: "网络层",
      type: "blank",
      stem: "OSPF 直接运行在 IP 之上，协议号是____。",
      answer: ["89"],
      explain: "OSPF 的 IP 协议号是 89，不使用 TCP 或 UDP 端口。",
      tags: ["OSPF"],
      hard: 2,
    },
    {
      id: "q_net_03",
      ch: "网络层",
      type: "single",
      stem: "OSPF 中 Area 0 的角色是？",
      choices: ["末梢区域", "骨干区域", "NSSA", "只用于虚链路"],
      answer: ["B"],
      explain: "Area 0 是骨干区域。其他区域一般要与骨干相连，否则需要虚链路。",
      tags: ["OSPF"],
    },
    {
      id: "q_net_04",
      ch: "网络层",
      type: "judge",
      stem: "在广播型网络上，OSPF 会选举 DR 与 BDR，以减少邻接数量。",
      answer: ["T"],
      explain: "广播和 NBMA 网络选举 DR/BDR。点到点链路不选举。",
      tags: ["OSPF"],
      hard: 2,
    },
    {
      id: "q_net_05",
      ch: "网络层",
      type: "single",
      stem: "把 IPv4 地址解析成局域网 MAC 地址，使用的是？",
      choices: ["DNS", "ARP", "ICMP", "DHCP"],
      answer: ["B"],
      explain: "ARP 在同一广播域内用 IP 询问对应的 MAC。DNS 解析的是域名。",
      tags: ["ARP"],
      hard: 1,
    },
    {
      id: "q_net_06",
      ch: "网络层",
      type: "single",
      stem: "子网掩码 255.255.255.192 对应的前缀长度，以及可用主机数是？",
      choices: ["/25，126 台", "/26，62 台", "/27，30 台", "/26，64 台"],
      answer: ["B"],
      explain: "192 的二进制是 2 位主机位被划进网络，即 /26。主机位剩 6 位，2^6−2=62。",
      tags: ["子网"],
      hard: 2,
    },
    {
      id: "q_net_07",
      ch: "网络层",
      type: "single",
      stem: "默认路由通常写成？",
      choices: ["127.0.0.1/8", "0.0.0.0/0", "255.255.255.255/32", "169.254.0.0/16"],
      answer: ["B"],
      explain: "0.0.0.0/0 匹配所有目的地址，是最后的兜底路由。",
      tags: ["路由"],
      hard: 1,
    },
    {
      id: "q_net_08",
      ch: "网络层",
      type: "single",
      stem: "BGP 主要用在什么场景？",
      choices: ["同一交换机的二层转发", "自治系统之间交换路由", "只在无线局域网", "代替 ARP"],
      answer: ["B"],
      explain: "BGP 是自治系统之间的路径矢量协议，运营商和多出口企业网络常用它选路。",
      tags: ["BGP"],
      hard: 2,
    },
    {
      id: "q_net_09",
      ch: "网络层",
      type: "multi",
      stem: "下列哪些属于 ICMP 的典型用途？",
      choices: ["探测可达性", "报告超时", "三次握手建立连接", "通知目的不可达"],
      answer: ["A", "B", "D"],
      explain: "ping 和很多差错报文走 ICMP。建立可靠连接是 TCP 的事。",
      tags: ["ICMP"],
    },
    {
      id: "q_net_10",
      ch: "传输层",
      type: "single",
      stem: "TCP 三次握手的第二次报文主要标志是？",
      choices: ["SYN", "SYN+ACK", "FIN+ACK", "PSH"],
      answer: ["B"],
      explain: "客户端发 SYN，服务端回 SYN+ACK，客户端再回 ACK。第二次同时确认对方并给出自己的初始序号。",
      tags: ["TCP"],
    },
    {
      id: "q_net_11",
      ch: "传输层",
      type: "short",
      stem: "用一两句话说明 TCP 为什么要三次握手，而不是两次。",
      answer: ["序号", "同步", "旧连接"],
      explain: "两边都要同步初始序号并确认对方的序号。两次握手无法挡住迟到的旧 SYN 把连接打开。关键词：序号、同步、旧连接。",
      tags: ["TCP"],
      hard: 3,
    },
    {
      id: "q_net_12",
      ch: "传输层",
      type: "single",
      stem: "主动关闭方在发完最后一个 ACK 后进入 TIME_WAIT，通常等待多久？",
      choices: ["1 个 RTT", "2MSL", "直到收到 FIN", "固定 1 秒"],
      answer: ["B"],
      explain: "等待 2MSL，确保最后的 ACK 若丢失对方还能重传 FIN，并让旧报文从网络中消失。",
      tags: ["TCP"],
      hard: 2,
    },
    {
      id: "q_net_13",
      ch: "传输层",
      type: "judge",
      stem: "UDP 提供确认、重传和拥塞控制。",
      answer: ["F"],
      explain: "UDP 只提供多路复用和校验，不保证可靠、不保序，也没有拥塞控制。",
      tags: ["UDP"],
      hard: 1,
    },
    {
      id: "q_net_14",
      ch: "传输层",
      type: "multi",
      stem: "TCP 实现可靠传输，依赖哪些机制？",
      choices: ["序号与确认", "超时重传", "滑动窗口", "把每段都改成广播"],
      answer: ["A", "B", "C"],
      explain: "序号、确认、重传和窗口共同完成可靠与流量控制。广播不是 TCP 的机制。",
      tags: ["TCP"],
    },
    {
      id: "q_net_15",
      ch: "应用层",
      type: "single",
      stem: "HTTPS 网页默认使用的端口是？",
      choices: ["80", "22", "443", "53"],
      answer: ["C"],
      explain: "80 是 HTTP，22 是 SSH，53 是 DNS，443 是 HTTPS。",
      tags: ["端口"],
      hard: 1,
    },
    {
      id: "q_net_16",
      ch: "应用层",
      type: "single",
      stem: "浏览器缓存仍有效、服务器未改内容时，常见的响应状态码是？",
      choices: ["200", "301", "304", "404"],
      answer: ["C"],
      explain: "304 Not Modified 表示可以用本地缓存。301 是永久重定向。",
      tags: ["HTTP"],
    },
    {
      id: "q_net_17",
      ch: "应用层",
      type: "single",
      stem: "递归解析与迭代解析的差别，更准确的说法是？",
      choices: [
        "递归时本地域名服务器替客户端把查询做完",
        "迭代只能解析 IPv6",
        "递归不使用缓存",
        "两者都一定从根服务器开始且不返回中间结果",
      ],
      answer: ["A"],
      explain: "递归查询由接受请求的服务器负责返回最终答案。迭代查询则返回下一步该问谁，由请求方继续问。",
      tags: ["DNS"],
      hard: 2,
    },
    {
      id: "q_net_18",
      ch: "应用层",
      type: "judge",
      stem: "TLS 加密了 HTTP 内容，因此应用自己的越权漏洞也不会再发生。",
      answer: ["F"],
      explain: "TLS 保护信道，不理解业务权限。登录后改一个别人的订单号，加密通道照样会把它送进去。",
      tags: ["TLS"],
      hard: 2,
    },
    {
      id: "q_net_19",
      ch: "网络层",
      type: "single",
      stem: "以太网常见的有效载荷 MTU 是？",
      choices: ["576", "1500", "9000 且不可调整", "64"],
      answer: ["B"],
      explain: "标准以太网 MTU 是 1500 字节。9000 是巨型帧，需要两端和中间设备都同意。",
      tags: ["链路"],
      hard: 1,
    },
    {
      id: "q_net_20",
      ch: "网络层",
      type: "single",
      stem: "一台主机地址是 10.1.1.20/24，它的网络地址是？",
      choices: ["10.1.1.0", "10.1.1.255", "10.1.0.0", "10.1.1.20"],
      answer: ["A"],
      explain: "/24 的主机位是最后 8 位，主机位清零得到 10.1.1.0，广播地址是 10.1.1.255。",
      tags: ["子网"],
      hard: 1,
    },
  ],
});

const security = bundle({
  id: "bank_sec",
  name: "安全审计基础",
  subject: "安全",
  description: "日志里要记什么、怎么看异常，以及那些加密解决不了的业务漏洞。",
  rows: [
    {
      id: "q_sec_01",
      ch: "日志",
      type: "multi",
      stem: "一条能拿去追责的审计日志，至少应该让人回答哪些问题？",
      choices: ["谁做的", "什么时候", "做了什么", "结果如何", "操作者的私人聊天记录"],
      answer: ["A", "B", "C", "D"],
      explain: "主体、时间、动作、客体和结果是审计最小集。无关的私人内容不该进审计日志。",
      tags: ["日志"],
    },
    {
      id: "q_sec_02",
      ch: "日志",
      type: "single",
      stem: "多台服务器的日志要放在一起分析，时间对不齐时最先该做的是？",
      choices: ["把时区全部改成浏览器本地时间后删除原日志", "用 NTP 同步时钟并保留原始时间戳", "只看最后一台的日志", "按文件名排序当作时间"],
      answer: ["B"],
      explain: "关联分析依赖统一时钟。应同步时间，同时保留原始时间戳和时区，而不是改写历史。",
      tags: ["NTP", "日志"],
    },
    {
      id: "q_sec_03",
      ch: "日志",
      type: "judge",
      stem: "把登录日志只存在被审计的那台机器本地，且管理员能随意删除，这样的设计适合追责。",
      answer: ["F"],
      explain: "日志应外送或写入管理员改不了的存储，否则当事人可以删掉对自己不利的记录。",
      tags: ["日志"],
    },
    {
      id: "q_sec_04",
      ch: "攻击与防护",
      type: "single",
      stem: "预防 SQL 注入，最稳妥的做法是？",
      choices: ["把单引号全局删掉", "使用参数化查询", "只在前端检查长度", "把数据库端口改到 3307"],
      answer: ["B"],
      explain: "参数化让语句结构和数据分开。删字符会误伤合法输入，改端口也不能阻止注入。",
      tags: ["注入"],
    },
    {
      id: "q_sec_05",
      ch: "攻击与防护",
      type: "single",
      stem: "用户能通过改 URL 里的订单号看到别人的订单。这更接近哪一类问题？",
      choices: ["反射型 XSS", "失效的对象级授权", "DNS 劫持", "压缩炸弹"],
      answer: ["B"],
      explain: "这是典型的越权 / IDOR：服务端没有核对这个对象是不是当前用户的。",
      tags: ["越权"],
      hard: 2,
    },
    {
      id: "q_sec_06",
      ch: "攻击与防护",
      type: "judge",
      stem: "只要全站启用了 HTTPS，跨站请求伪造就不会发生。",
      answer: ["F"],
      explain: "CSRF 利用的是浏览器会自动带上 Cookie。需要 CSRF token、SameSite 等，而不是只靠 TLS。",
      tags: ["CSRF"],
    },
    {
      id: "q_sec_07",
      ch: "攻击与防护",
      type: "short",
      stem: "什么叫最小权限？请用自己的话写一句。",
      answer: ["完成", "所需", "最小"],
      explain: "主体只应拥有完成当前工作所必需的最小权限，而且用完可收。评分看是否点出「完成工作所需」和「最小」。",
      tags: ["权限"],
      hard: 2,
    },
    {
      id: "q_sec_08",
      ch: "访问控制",
      type: "single",
      stem: "口令在服务端应该怎么保存？",
      choices: ["可逆加密，方便找回原文", "加盐的慢哈希", "明文，方便客服核对", "只做 Base64"],
      answer: ["B"],
      explain: "口令不需要还原。应使用带盐的慢哈希（如 bcrypt、scrypt、Argon2）。Base64 不是加密。",
      tags: ["口令"],
    },
    {
      id: "q_sec_09",
      ch: "访问控制",
      type: "blank",
      stem: "SHA-256 这类函数的输出长度固定，且设计上不可____。",
      answer: ["逆", "反推", "还原"],
      explain: "密码学哈希是单向的，不能从摘要反推出原文。它不是加密，因为没有密钥可以解密。",
      tags: ["哈希"],
    },
    {
      id: "q_sec_10",
      ch: "访问控制",
      type: "single",
      stem: "运维必须登录服务器，但又要留下谁在何时执行了什么命令。更合适的设施是？",
      choices: ["大家共用 root 密码", "堡垒机统一登录并录像审计", "把 SSH 端口写成 22 以外即可", "关闭所有日志节省磁盘"],
      answer: ["B"],
      explain: "堡垒机集中身份、授权和会话审计，避免共享口令。改端口只是降低扫描噪音。",
      tags: ["堡垒机"],
    },
    {
      id: "q_sec_11",
      ch: "异常行为",
      type: "single",
      stem: "同一账号在一分钟内出现几十次失败登录，接下来仍有成功。优先怀疑？",
      choices: ["日志格式不兼容", "口令被撞库或暴力破解", "NTP 快了两秒", "磁盘只是碎片化"],
      answer: ["B"],
      explain: "短时间大量失败后成功，是撞库或暴力破解的典型形状。应锁定、报警并核对该次成功的来源。",
      tags: ["暴力破解"],
    },
    {
      id: "q_sec_12",
      ch: "异常行为",
      type: "single",
      stem: "建立用户平时的登录时间、来源网段和访问量，再标出明显偏离。这种方法叫？",
      choices: ["基线与偏离检测", "只靠一条正则匹配全部攻击", "关闭认证", "人工每天读完原始包"],
      answer: ["A"],
      explain: "异常检测通常先有正常行为基线，再找偏离。单一正则盖不住未知手法，但基线也不能替代具体检测规则。",
      tags: ["异常检测"],
      hard: 2,
    },
    {
      id: "q_sec_13",
      ch: "异常行为",
      type: "multi",
      stem: "把日志送进 SIEM 之后，它通常帮你做哪些事？",
      choices: ["集中检索", "跨源关联", "按规则告警", "自动代替所有应急处置"],
      answer: ["A", "B", "C"],
      explain: "SIEM 擅长收集、关联和告警。处置仍要人和流程，不能指望它独自完成应急。",
      tags: ["SIEM"],
    },
    {
      id: "q_sec_14",
      ch: "攻击与防护",
      type: "single",
      stem: "页面把用户输入的昵称原样插进 HTML。攻击者提交一段脚本后，其他访客浏览器执行了它。这是？",
      choices: ["存储型 XSS", "SQL 注入", "ARP 欺骗", "仅是 CSS 排版错误"],
      answer: ["A"],
      explain: "恶意内容被存下来并在别人的页面里执行，是存储型 XSS。输出时要编码，富文本还要白名单。",
      tags: ["XSS"],
    },
    {
      id: "q_sec_15",
      ch: "访问控制",
      type: "judge",
      stem: "对称加密适合大量数据，非对称加密常用来传递对称密钥或做签名。",
      answer: ["T"],
      explain: "AES 这类对称算法快，适合正文。RSA/ECC 慢，常用于密钥交换和签名，两者经常一起用。",
      tags: ["加密"],
      hard: 2,
    },
    {
      id: "q_sec_16",
      ch: "异常行为",
      type: "short",
      stem: "为什么业务逻辑漏洞（例如把商品数量改成负数从而加钱）很难只靠防火墙发现？",
      answer: ["合法", "请求", "业务"],
      explain: "这类请求在协议上看起来完全合法，防火墙不懂「数量不能为负」。要点是请求合法，但违反业务规则。",
      tags: ["业务逻辑"],
      hard: 3,
    },
  ],
});

export function seedLibrary(): Library {
  const lib = emptyLibrary();
  const demo = frameDemo();
  lib.banks = [network.bank, security.bank, demo.bank];
  lib.chapters = [...network.chapters, ...security.chapters, ...demo.chapters];
  lib.questions = [...network.questions, ...security.questions, ...demo.questions];
  lib.flags = ["frame-demo"];
  return lib;
}
