import type { Bank, Chapter, Question } from "./types";
import { canonicalChosen, type ItemFrame } from "./frame";

const NOW = "2026-11-07T08:00:00.000Z";

function frame(partial: Pick<ItemFrame, "interaction" | "typeName" | "key"> & Partial<ItemFrame>): ItemFrame {
  return {
    v: 1,
    id: "",
    select: "one",
    unique: false,
    tolerance: 0,
    keywordMode: "all",
    keywordRatio: 0.6,
    keywords: [],
    stem: "",
    stemCode: false,
    image: "",
    imageAlt: "",
    imageCredit: "",
    audio: "",
    audioTitle: "",
    audioCredit: "",
    options: [],
    left: [],
    right: [],
    rows: [],
    cols: [],
    items: [],
    bins: [],
    regions: [],
    fields: [],
    blankOptions: {},
    explain: [],
    subs: [],
    ...partial,
  };
}

function question(id: string, chapterId: string, stem: string, item: ItemFrame, hard: 1 | 2 | 3 = 2): Question {
  return {
    id,
    bankId: "bank_frame",
    chapterId,
    type: "frame",
    stem,
    choices: [],
    answer: canonicalChosen(item),
    explanation: item.explain.map((bit) => bit.text).filter(Boolean).join("\n"),
    difficulty: hard,
    tags: [item.typeName],
    source: "题型框架示例",
    frame: item,
  };
}

export function frameDemo(): { bank: Bank; chapters: Chapter[]; questions: Question[] } {
  const chapters: Chapter[] = [
    { id: "bank_frame_0", bankId: "bank_frame", name: "选择与挖空", order: 0 },
    { id: "bank_frame_1", bankId: "bank_frame", name: "排序连线分类", order: 1 },
    { id: "bank_frame_2", bankId: "bank_frame", name: "综合", order: 2 },
  ];
  const questions: Question[] = [
    question(
      "q_fr_slots",
      chapters[0]!.id,
      "七选五：TCP 如何保证可靠",
      frame({
        typeName: "七选五",
        interaction: "slots",
        unique: true,
        stem: "TCP 用{{1}}把字节重新排好，用{{2}}告诉对方还能收多少。确认号表示{{3}}之前的字节都收到了。",
        options: [
          { id: "A", text: "序号" },
          { id: "B", text: "窗口" },
          { id: "C", text: "下一个期望字节" },
          { id: "D", text: "MAC 地址" },
          { id: "E", text: "路由跳数" },
        ],
        key: ["1=A", "2=B", "3=C"],
        explain: [
          { target: "1", text: "序号解决乱序和重传，不是 MAC。" },
          { target: "2", text: "接收窗口广告的是还能收的缓冲，用来做流量控制。" },
          { target: "3", text: "累计确认：确认号之前的字节都算收到了。" },
        ],
      }),
    ),
    question(
      "q_fr_blank",
      chapters[0]!.id,
      "多空：DNS 与 ARP",
      frame({
        typeName: "多空填空",
        interaction: "blanks",
        stem: "把域名换成 IP 用的是{{1}}。同一广播域里用 IP 问 MAC，用的是{{2}}。",
        key: ["1=DNS|dns", "2=ARP|arp"],
        explain: [
          { target: "1", text: "DNS 负责名字，不负责二层地址。" },
          { target: "2", text: "ARP 只在同一链路里问「这个 IP 的 MAC 是谁」。" },
        ],
      }),
    ),
    question(
      "q_fr_num",
      chapters[0]!.id,
      "数值：IPv4 /26 有多少可用主机",
      frame({
        typeName: "数值",
        interaction: "numeric",
        tolerance: 0,
        stem: "一个 IPv4 /26 网络，去掉网络地址和广播地址，可用主机地址有多少个？",
        key: ["62"],
        explain: [{ target: "*", text: "/26 有 6 位主机号，2^6 − 2 = 62。写成 64 会把两个保留地址也算进去。" }],
      }),
      3,
    ),
    question(
      "q_fr_pairs",
      chapters[1]!.id,
      "连线：协议放到哪一层",
      frame({
        typeName: "连线",
        interaction: "pairs",
        stem: "把协议和它最常被放进的层连起来。",
        left: [
          { id: "ip", text: "IP" },
          { id: "tcp", text: "TCP" },
          { id: "arp", text: "ARP" },
        ],
        right: [
          { id: "net", text: "网络层" },
          { id: "tran", text: "传输层" },
          { id: "link", text: "链路层" },
        ],
        key: ["ip>net", "tcp>tran", "arp>link"],
        explain: [
          { target: "ip", text: "IP 负责跨网络选路。" },
          { target: "tcp", text: "TCP 在端到端之间提供字节流。" },
          { target: "arp", text: "ARP 解决同一链路上 IP 和 MAC 的对应，不算传输层。" },
        ],
      }),
    ),
    question(
      "q_fr_order",
      chapters[1]!.id,
      "排序：TCP 三次握手",
      frame({
        typeName: "排序",
        interaction: "order",
        stem: "把 TCP 三次握手排成实际发生的顺序。",
        items: [
          { id: "syn", text: "客户端发送 SYN" },
          { id: "synack", text: "服务端回复 SYN-ACK" },
          { id: "ack", text: "客户端再发送 ACK" },
        ],
        key: ["syn", "synack", "ack"],
        explain: [
          { target: "syn", text: "主动打开方先发 SYN。" },
          { target: "synack", text: "被动方确认对方的序号，并带上自己的 SYN。" },
          { target: "ack", text: "第三次才把服务端的序号确认掉，连接进入已建立。" },
        ],
      }),
    ),
    question(
      "q_fr_bins",
      chapters[1]!.id,
      "分类：这些算法是对称还是非对称",
      frame({
        typeName: "分类",
        interaction: "bins",
        stem: "把算法放进对应的篮子。",
        bins: [
          { id: "sym", text: "对称加密" },
          { id: "asym", text: "非对称加密" },
        ],
        items: [
          { id: "aes", text: "AES" },
          { id: "rsa", text: "RSA" },
          { id: "des", text: "3DES" },
          { id: "ecc", text: "ECC" },
        ],
        key: ["aes=sym", "rsa=asym", "des=sym", "ecc=asym"],
        explain: [
          { target: "aes", text: "AES 是分组对称算法，适合加密正文。" },
          { target: "des", text: "3DES 也是对称算法，只是过时了。" },
          { target: "rsa", text: "RSA 用公私钥，常用来交换密钥或签名。" },
          { target: "ecc", text: "椭圆曲线同样是非对称，密钥更短。" },
        ],
      }),
    ),
    question(
      "q_fr_matrix",
      chapters[1]!.id,
      "矩阵：这两句话对不对",
      frame({
        typeName: "矩阵判断",
        interaction: "matrix",
        stem: "每句话单独判断。",
        rows: [
          { id: "ship", text: "审计日志应该送到当事人改不了的地方" },
          { id: "fw", text: "防火墙只要看端口，就能发现把购买数量改成负数" },
        ],
        cols: [
          { id: "T", text: "对" },
          { id: "F", text: "错" },
        ],
        key: ["ship=T", "fw=F"],
        explain: [
          { target: "ship", text: "日志留在本机、管理员又能删，追责就断了。" },
          { target: "fw", text: "数量为负在协议上是合法请求。这是业务规则，不是端口过滤能看出来的。" },
        ],
      }),
    ),
    question(
      "q_fr_patch",
      chapters[2]!.id,
      "改错：序号和窗口写反了",
      frame({
        typeName: "短文改错",
        interaction: "patch",
        stem: "下面两处写反了，点出来并改成正确用词。TCP 靠[[a|窗口]]保证字节按序到达，靠[[b|序号]]告诉对方还能收多少。",
        key: ["a=序号", "b=窗口"],
        explain: [
          { target: "a", text: "按序靠的是序号，不是窗口。" },
          { target: "b", text: "还能收多少，说的是接收窗口。" },
        ],
      }),
      3,
    ),
    question(
      "q_fr_hi",
      chapters[2]!.id,
      "划线：哪一段不该进审计日志",
      frame({
        typeName: "划线",
        interaction: "highlight",
        stem: "一条追责日志可以记下[[ok|谁在何时做了什么以及结果]]，不应该记下[[bad|操作者的私人聊天记录]]。点出不该出现的那一段。",
        key: ["bad"],
        explain: [
          { target: "bad", text: "私人聊天和这次操作无关，不该进审计日志。" },
          { target: "ok", text: "主体、时间、动作、结果正是审计要回答的事。" },
        ],
      }),
    ),
    question(
      "q_fr_audio",
      chapters[2]!.id,
      "辨音：这段界面音效是哪一种",
      frame({
        typeName: "辨音",
        interaction: "choice",
        stem: "先听一遍。它更接近哪一种反馈？",
        audio: "/cc/kenney/bong_001.wav",
        audioTitle: "待辨认片段",
        audioCredit: "Kenney Interface Sounds，CC0",
        options: [
          { id: "A", text: "明亮的成功确认" },
          { id: "B", text: "刺耳的错误警告" },
          { id: "C", text: "短促的一声砰" },
        ],
        key: ["C"],
        explain: [
          { target: "C", text: "这是 bong，短、闷，用来提示一声落下，不是答对，也不是报错。" },
          { target: "A", text: "成功音更亮、更完整，听起来像「叮」。" },
          { target: "B", text: "错误音通常更长，而且不那么干脆。" },
        ],
      }),
    ),
    question(
      "q_fr_icon",
      chapters[2]!.id,
      "附图选项",
      frame({
        typeName: "图片单选",
        interaction: "choice",
        stem: "选项可以附一张小图，没有图就不写。指出放大镜。",
        options: [
          { id: "glass", text: "甲", image: "/cc/icons/magnifying-glass.svg", alt: "放大镜" },
          { id: "speaker", text: "乙", image: "/cc/icons/speaker.svg", alt: "喇叭" },
          { id: "star", text: "丙", image: "/cc/icons/star-medal.svg", alt: "星章" },
          { id: "owl", text: "丁", image: "/cc/icons/owl.svg", alt: "猫头鹰" },
        ],
        key: ["glass"],
        explain: [
          { target: "glass", text: "圆镜加短柄，是放大镜。图标来自 game-icons.net（CC BY 3.0），界面里改成了深色。" },
          { target: "speaker", text: "这是喇叭。" },
          { target: "owl", text: "这是猫头鹰，不是镜片。" },
        ],
      }),
    ),
    question(
      "q_fr_custom",
      chapters[2]!.id,
      "怪题：把这条日志拆开",
      frame({
        typeName: "日志拆注",
        interaction: "custom",
        stem: "日志原文：03:11 admin deny /etc/shadow",
        fields: [
          { id: "time", kind: "text", prompt: "写出时间", options: [] },
          {
            id: "act",
            kind: "choice",
            prompt: "动作属于",
            options: [
              { id: "deny", text: "拒绝" },
              { id: "allow", text: "放行" },
            ],
          },
        ],
        key: ["time=03:11|3:11", "act=deny"],
        explain: [
          { target: "time", text: "时间在最前面，03:11。" },
          { target: "act", text: "deny 是拒绝。放行才会写成 allow 或 permit。" },
        ],
      }),
      3,
    ),
    question(
      "q_fr_read",
      chapters[2]!.id,
      "材料：一次说得通的扫描",
      frame({
        typeName: "材料题",
        interaction: "material",
        stem: "值班日志写着：同一源地址在 40 秒里对 200 个端口发 SYN，几乎没有完成握手。同一分钟，这台机器的 SSH 登录全部失败。",
        key: [],
        explain: [{ target: "*", text: "两问都对，这道材料题才算过。" }],
        subs: [
          frame({
            id: "s1",
            typeName: "细节",
            interaction: "choice",
            stem: "这更像什么？",
            options: [
              { id: "A", text: "正常的网页浏览" },
              { id: "B", text: "端口扫描，而且后面还在撞 SSH" },
              { id: "C", text: "只是 NTP 对时" },
            ],
            key: ["B"],
            explain: [{ target: "B", text: "短时间打很多端口、握手完不成，是扫描。紧接着的 SSH 失败说明对方还在试登录。" }],
          }),
          frame({
            id: "s2",
            typeName: "填空",
            interaction: "blanks",
            stem: "只靠防火墙的端口放行，很难发现这件事，因为它看起来仍是{{1}}的报文。",
            key: ["1=合法|正常"],
            explain: [{ target: "1", text: "SYN 本身合法。异常在于数量、目标和业务含义，不在于包头坏了。" }],
          }),
        ],
      }),
      3,
    ),
  ];
  return {
    bank: {
      id: "bank_frame",
      name: "题型框架",
      subject: "全题型",
      description: "选择、填空、排序、连线、改错和材料题用同一套格式。附图和点图都是可选项。",
      createdAt: NOW,
      updatedAt: NOW,
    },
    chapters,
    questions,
  };
}
