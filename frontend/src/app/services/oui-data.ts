// Keyed as 6 uppercase hex chars (first 3 MAC octets, no separators)
export const OUI: Record<string, string> = {
  // Apple
  "000393":"Apple","000502":"Apple","000A27":"Apple","000A95":"Apple","000D93":"Apple","000E7F":"Apple",
  "001124":"Apple","001451":"Apple","0016B6":"Apple","0017F2":"Apple","0019E3":"Apple","001B63":"Apple",
  "001CB3":"Apple","001D4F":"Apple","001E52":"Apple","001EC2":"Apple","001F5B":"Apple","001FF3":"Apple",
  "0021E9":"Apple","002241":"Apple","002312":"Apple","002332":"Apple","00236C":"Apple","0023DF":"Apple",
  "002436":"Apple","002500":"Apple","00254B":"Apple","0025BC":"Apple","002608":"Apple","00264A":"Apple",
  "0026B9":"Apple","0026BB":"Apple","003065":"Apple","00A040":"Apple","040CCE":"Apple","041552":"Apple",
  "042665":"Apple","04489A":"Apple","0452F3":"Apple","045453":"Apple","0469F8":"Apple","04DB56":"Apple",
  "04E536":"Apple","04F13E":"Apple","04F7E4":"Apple","08006D":"Apple","087045":"Apple","087402":"Apple",
  "08F4AB":"Apple","0C1539":"Apple","0C3E9F":"Apple","0C4DE9":"Apple","0C5101":"Apple","0C74C2":"Apple",
  "0C771A":"Apple","0CBC9F":"Apple","0CD746":"Apple","101C0C":"Apple","1040F3":"Apple","10417F":"Apple",
  "1093E9":"Apple","109ADD":"Apple","14109F":"Apple","14205E":"Apple","145A05":"Apple","148FC6":"Apple",
  "1499E2":"Apple","182032":"Apple","183451":"Apple","186590":"Apple","18810E":"Apple","189EFC":"Apple",
  "18AF61":"Apple","18AF8F":"Apple","1C36BB":"Apple","1C9148":"Apple","1C9E46":"Apple","20768F":"Apple",
  "209BCD":"Apple","20C9D0":"Apple","241EEB":"Apple","245BA7":"Apple","24A074":"Apple","280B5C":"Apple",
  "2827BF":"Apple","283737":"Apple","283B82":"Apple","285AEB":"Apple","286ABA":"Apple","28CFDA":"Apple",
  "28CFE9":"Apple","28E02C":"Apple","28E14C":"Apple","2C1F23":"Apple","2C200B":"Apple","2C61F6":"Apple",
  "2CBE08":"Apple","2CF0A2":"Apple","3010B3":"Apple","3035AD":"Apple","30636B":"Apple","3090AB":"Apple",
  "30F7C5":"Apple","341298":"Apple","34363B":"Apple","3451C9":"Apple","347C25":"Apple","34A395":"Apple",
  "34C059":"Apple","380F4A":"Apple","38484C":"Apple","3866F0":"Apple","38B54D":"Apple","3C0754":"Apple",
  "3C15C2":"Apple","3C2EF9":"Apple","3CD0F8":"Apple","403CFC":"Apple","406C8F":"Apple","4083DE":"Apple",
  "40A6D9":"Apple","40B395":"Apple","40CBC0":"Apple","40D32D":"Apple","442A60":"Apple","444C0C":"Apple",
  "44D884":"Apple","44FB42":"Apple","483B38":"Apple","48437C":"Apple","4860BC":"Apple","48746E":"Apple",
  "48A195":"Apple","48BF6B":"Apple","48D705":"Apple","4C3275":"Apple","4C57CA":"Apple","4C74BF":"Apple",
  "4C7C5F":"Apple","4C8D79":"Apple","503237":"Apple","507A55":"Apple","5082D5":"Apple","50BC96":"Apple",
  "50EAD6":"Apple","542696":"Apple","5433CB":"Apple","544E90":"Apple","54724F":"Apple","549F13":"Apple",
  "54AE27":"Apple","54E43A":"Apple","581FAA":"Apple","58404E":"Apple","5855CA":"Apple","587F57":"Apple",
  "58B035":"Apple","5C5188":"Apple","5C5948":"Apple","5CADCF":"Apple","5CF5DA":"Apple","5CF7E6":"Apple",
  "600308":"Apple","60334B":"Apple","606944":"Apple","608C4A":"Apple","60A37D":"Apple","60C547":"Apple",
  "60D9C7":"Apple","60F445":"Apple","60F81D":"Apple","64200C":"Apple","645A04":"Apple","6476BA":"Apple",
  "649ABE":"Apple","64A3CB":"Apple","64B9E8":"Apple","680927":"Apple","685B35":"Apple","68644B":"Apple",
  "689C70":"Apple","68A86D":"Apple","68ABBC":"Apple","6C19C0":"Apple","6C4008":"Apple","6C709F":"Apple",
  "6C72E7":"Apple","6C8DC1":"Apple","6C94F8":"Apple","6C9AE0":"Apple","6CC26B":"Apple","6CF373":"Apple",
  "701124":"Apple","7014A6":"Apple","703EAC":"Apple","70480F":"Apple","704CA5":"Apple","705681":"Apple",
  "70700D":"Apple","7073CB":"Apple","70E72C":"Apple","70ECE4":"Apple","741BB2":"Apple","741DDA":"Apple",
  "74E20C":"Apple","74E1B6":"Apple","74E543":"Apple","74F61C":"Apple","7831C1":"Apple","784F43":"Apple",
  "7867D7":"Apple","786C1C":"Apple","787B8A":"Apple","78886D":"Apple","789F70":"Apple","78D75F":"Apple",
  "78FD94":"Apple","7C0191":"Apple","7C04D0":"Apple","7C11BE":"Apple","7C6D62":"Apple","7CC3A1":"Apple",
  "7CD1C3":"Apple","7CF05F":"Apple","80006E":"Apple","804971":"Apple","808223":"Apple","80BE05":"Apple",
  "80E650":"Apple","80ED2C":"Apple","842999":"Apple","843835":"Apple","84683E":"Apple","84788B":"Apple",
  "848506":"Apple","8489AD":"Apple","84A134":"Apple","84B153":"Apple","84FCAC":"Apple","881FA1":"Apple",
  "88C663":"Apple","88E9FE":"Apple","8C006D":"Apple","8C2DAA":"Apple","8C5877":"Apple","8C7C92":"Apple",
  "8C7B9D":"Apple","8C8590":"Apple","8C8EF2":"Apple","9027E4":"Apple","903C92":"Apple","9060F1":"Apple",
  "907240":"Apple","90840D":"Apple","908D6C":"Apple","90B0ED":"Apple","90C1C6":"Apple","94BF2D":"Apple",
  "94E96A":"Apple","9800C6":"Apple","9801A7":"Apple","9803D8":"Apple","985AEB":"Apple","98CA33":"Apple",
  "98D6BB":"Apple","98E0D9":"Apple","98F0AB":"Apple","9C04EB":"Apple","9C207B":"Apple","9C35EB":"Apple",
  "9C84BF":"Apple","9CF387":"Apple","A01828":"Apple","A03BE3":"Apple","A04EA7":"Apple","A0999B":"Apple",
  "A0D795":"Apple","A45E60":"Apple","A46706":"Apple","A483E7":"Apple","A4B197":"Apple","A4C361":"Apple",
  "A4D18C":"Apple","A4D931":"Apple","A82066":"Apple","A851AB":"Apple","A85C2C":"Apple","A86BAD":"Apple",
  "A88E24":"Apple","A8968A":"Apple","A8BBCF":"Apple","AC1F74":"Apple","AC293A":"Apple","AC3C0B":"Apple",
  "AC61EA":"Apple","AC87A3":"Apple","ACBC32":"Apple","ACCF85":"Apple","ACDE48":"Apple","B019C6":"Apple",
  "B03495":"Apple","B065BD":"Apple","B0702D":"Apple","B09FBA":"Apple","B418D1":"Apple","B44BD2":"Apple",
  "B49CDF":"Apple","B4F61C":"Apple","B8098A":"Apple","B817C2":"Apple","B844D9":"Apple","B853AC":"Apple",
  "B85D0A":"Apple","B8634D":"Apple","B8782E":"Apple","B8C75D":"Apple","B8E856":"Apple","BC3BAF":"Apple",
  "BC52B7":"Apple","BC5436":"Apple","BC6778":"Apple","BC926B":"Apple","BC9FEF":"Apple","BCA920":"Apple",
  "BCEC5D":"Apple","C01ADA":"Apple","C07CD1":"Apple","C0847A":"Apple","C09F05":"Apple","C0CECD":"Apple",
  "C42C03":"Apple","C4B301":"Apple","C82A14":"Apple","C8334B":"Apple","C83C85":"Apple","C869CD":"Apple",
  "C86F1D":"Apple","C88550":"Apple","C8BCC8":"Apple","C8D083":"Apple","C8E0EB":"Apple","C8F650":"Apple",
  "CC088D":"Apple","CC25EF":"Apple","CC29F5":"Apple","CC4463":"Apple","CCC760":"Apple","D0034B":"Apple",
  "D023DB":"Apple","D02598":"Apple","D03311":"Apple","D04F7E":"Apple","D0A637":"Apple","D420B0":"Apple",
  "D4619D":"Apple","D4909C":"Apple","D4A33D":"Apple","D4F46F":"Apple","D8004D":"Apple","D81D72":"Apple",
  "D83062":"Apple","D89695":"Apple","D89E3F":"Apple","D8A25E":"Apple","D8BB2C":"Apple","D8D1CB":"Apple",
  "DC0C5C":"Apple","DC2B2A":"Apple","DC3714":"Apple","DC415F":"Apple","DC56E7":"Apple","DC86D8":"Apple",
  "DC9B9C":"Apple","DCA4CA":"Apple","E05F45":"Apple","E06678":"Apple","E0ACCB":"Apple","E0B55F":"Apple",
  "E0B9BA":"Apple","E425E7":"Apple","E48B7F":"Apple","E49A79":"Apple","E4C767":"Apple","E4CE8F":"Apple",
  "E80688":"Apple","E80462":"Apple","E8802E":"Apple","E88D28":"Apple","E8B2AC":"Apple","EC3586":"Apple",
  "EC852F":"Apple","F01898":"Apple","F02F4B":"Apple","F05C77":"Apple","F0728C":"Apple","F07960":"Apple",
  "F099BF":"Apple","F0B479":"Apple","F0CBA1":"Apple","F0D1A9":"Apple","F0DBF8":"Apple","F40F24":"Apple",
  "F41BA1":"Apple","F431C3":"Apple","F437B7":"Apple","F45C89":"Apple","F4F15A":"Apple","F4F951":"Apple",
  "F82793":"Apple","F83AB6":"Apple","F81EDF":"Apple","F86214":"Apple","FC253F":"Apple","FC2A9C":"Apple",
  "FCFC48":"Apple",

  // Samsung
  "000078":"Samsung","0000F0":"Samsung","0007AB":"Samsung","000DE5":"Samsung","000FE7":"Samsung",
  "0012FB":"Samsung","001247":"Samsung","001377":"Samsung","0015B9":"Samsung","0016DB":"Samsung",
  "001732":"Samsung","001836":"Samsung","001A8A":"Samsung","001B98":"Samsung","001CBA":"Samsung",
  "001DF7":"Samsung","001EE1":"Samsung","001FCC":"Samsung","0021D1":"Samsung","002339":"Samsung",
  "002399":"Samsung","0023D6":"Samsung","00244B":"Samsung","002490":"Samsung","0026E2":"Samsung",
  "00E064":"Samsung","087702":"Samsung","08D42B":"Samsung","0C143D":"Samsung","0C89D9":"Samsung",
  "102477":"Samsung","107B44":"Samsung","1099A8":"Samsung","1472B2":"Samsung","141F7A":"Samsung",
  "141DA7":"Samsung","182242":"Samsung","1C62B8":"Samsung","1C66AA":"Samsung","200DEE":"Samsung",
  "2072D1":"Samsung","20D390":"Samsung","2490E7":"Samsung","244BFE":"Samsung","248A27":"Samsung",
  "28987B":"Samsung","28BAB5":"Samsung","2C4401":"Samsung","2C6354":"Samsung","2CAD52":"Samsung",
  "2CD2E7":"Samsung","302D55":"Samsung","3007AC":"Samsung","3011CA":"Samsung","344DF7":"Samsung",
  "348A28":"Samsung","34BE00":"Samsung","34C3AC":"Samsung","38167B":"Samsung","381C1A":"Samsung",
  "381F8E":"Samsung","38AA3C":"Samsung","38D40B":"Samsung","38ECE4":"Samsung","3C5A37":"Samsung",
  "3C8BFE":"Samsung","40B8AB":"Samsung","40B6AC":"Samsung","40D334":"Samsung","4483BB":"Samsung",
  "448505":"Samsung","44571E":"Samsung","44779B":"Samsung","4492A0":"Samsung","48131E":"Samsung",
  "4850E3":"Samsung","48DB50":"Samsung","4C3C16":"Samsung","4CACF3":"Samsung","4CB16C":"Samsung",
  "4CEFA0":"Samsung","4CFCAA":"Samsung","5056A8":"Samsung","50A4C8":"Samsung","50C8B8":"Samsung",
  "5479DE":"Samsung","545151":"Samsung","5476E5":"Samsung","58B135":"Samsung","5C3C27":"Samsung",
  "5C49EB":"Samsung","5CA33E":"Samsung","5CCA70":"Samsung","5CF6DC":"Samsung","60014F":"Samsung",
  "6077E2":"Samsung","60A10A":"Samsung","60D0A9":"Samsung","64B853":"Samsung","6489F4":"Samsung",
  "64B9D1":"Samsung","6816F7":"Samsung","6C5009":"Samsung","6CE8C6":"Samsung","6C9400":"Samsung",
  "70F927":"Samsung","709F2D":"Samsung","740291":"Samsung","743A20":"Samsung","74458A":"Samsung",
  "7487F7":"Samsung","74E050":"Samsung","74E271":"Samsung","749AC1":"Samsung","780A39":"Samsung",
  "7C1CF3":"Samsung","7CD02A":"Samsung","8018A7":"Samsung","802598":"Samsung","809896":"Samsung",
  "8097B3":"Samsung","84A466":"Samsung","8425DB":"Samsung","8452E0":"Samsung","8455A5":"Samsung",
  "88329B":"Samsung","887BEF":"Samsung","88D2AC":"Samsung","88E7E4":"Samsung","8C1ABF":"Samsung",
  "8C3F36":"Samsung","8C7D69":"Samsung","8CF586":"Samsung","900F6E":"Samsung","90F1AA":"Samsung",
  "946C20":"Samsung","9882FF":"Samsung","988391":"Samsung","98D71D":"Samsung","98DFC3":"Samsung",
  "98E7F4":"Samsung","9C0278":"Samsung","9C3226":"Samsung","9C936C":"Samsung","A0075E":"Samsung",
  "A00BBA":"Samsung","A0D38F":"Samsung","A4478A":"Samsung","A4ADD9":"Samsung","A47AE3":"Samsung",
  "A4B689":"Samsung","A8F274":"Samsung","ACB76E":"Samsung","ACB873":"Samsung","ACEE9E":"Samsung",
  "B047BF":"Samsung","B0C559":"Samsung","B0C67B":"Samsung","B07794":"Samsung","B4625C":"Samsung",
  "B4EF39":"Samsung","B4F7A1":"Samsung","B8D9CE":"Samsung","BCED6D":"Samsung","C001BB":"Samsung",
  "C412F5":"Samsung","C47A4D":"Samsung","C487E4":"Samsung","C4AE12":"Samsung","C871F1":"Samsung",
  "CC0C00":"Samsung","CCCEB6":"Samsung","CCF9A4":"Samsung","D0176A":"Samsung","D022BE":"Samsung",
  "D097C2":"Samsung","D018AE":"Samsung","D098D3":"Samsung","D0C1B1":"Samsung","D4E8B2":"Samsung",
  "D4888C":"Samsung","D87195":"Samsung","D8943B":"Samsung","DC7144":"Samsung","DCDC1F":"Samsung",
  "E0354B":"Samsung","E04C70":"Samsung","E08C36":"Samsung","E03E5C":"Samsung","E0A7B0":"Samsung",
  "E4A7EA":"Samsung","E4D53D":"Samsung","E4321B":"Samsung","E44EA7":"Samsung","EC1F72":"Samsung",
  "F009D7":"Samsung","F00F61":"Samsung","F015B9":"Samsung","F016BD":"Samsung","F019DA":"Samsung",
  "F44336":"Samsung","F4FCA7":"Samsung","F87FBF":"Samsung","F897CF":"Samsung","FC0012":"Samsung",

  // Huawei
  "000E5E":"Huawei","001882":"Huawei","0019C6":"Huawei","001E10":"Huawei","0025D3":"Huawei","002569":"Huawei",
  "0025AF":"Huawei","002773":"Huawei","006540":"Huawei","00E0FC":"Huawei","28B448":"Huawei","287B09":"Huawei",
  "2C5527":"Huawei","3CB39D":"Huawei","44C346":"Huawei","4C54BE":"Huawei","4C8BEF":"Huawei","4C9EFF":"Huawei",
  "504B5A":"Huawei","5417F6":"Huawei","547BE6":"Huawei","58605F":"Huawei","5C4CA9":"Huawei","5C8A38":"Huawei",
  "6005A7":"Huawei","6438E0":"Huawei","6C8D37":"Huawei","70726E":"Huawei","70726F":"Huawei","78D752":"Huawei",
  "7CFE90":"Huawei","8047BA":"Huawei","8067F4":"Huawei","8C34FD":"Huawei","90671C":"Huawei","94049C":"Huawei",
  "9C28EF":"Huawei","9C52F8":"Huawei","9CB2B2":"Huawei","A47974":"Huawei","A49C0E":"Huawei","ACE215":"Huawei",
  "B499BA":"Huawei","BC7670":"Huawei","C48E8F":"Huawei","C8514A":"Huawei","CCCC81":"Huawei","D065CA":"Huawei",
  "D0FF98":"Huawei","D440F0":"Huawei","D4878D":"Huawei","D4F2CA":"Huawei","DC727C":"Huawei","E85D4B":"Huawei",
  "EC2388":"Huawei","F44C7F":"Huawei","F48B32":"Huawei","F80113":"Huawei","FC3F7C":"Huawei","F44D30":"Huawei",

  // Xiaomi
  "002842":"Xiaomi","0C1DAF":"Xiaomi","10AB33":"Xiaomi","286C07":"Xiaomi","34CE00":"Xiaomi","38A28C":"Xiaomi",
  "3C9872":"Xiaomi","440A15":"Xiaomi","506785":"Xiaomi","58DDBC":"Xiaomi","5C9935":"Xiaomi","64B473":"Xiaomi",
  "681AB2":"Xiaomi","6C9660":"Xiaomi","74518B":"Xiaomi","782712":"Xiaomi","7CF561":"Xiaomi","8C9748":"Xiaomi",
  "8CEBC6":"Xiaomi","9C99A0":"Xiaomi","A01064":"Xiaomi","A454B8":"Xiaomi","AC2B8C":"Xiaomi","B0E235":"Xiaomi",
  "B4F1DA":"Xiaomi","C2B04F":"Xiaomi","C40BCB":"Xiaomi","CC2D83":"Xiaomi","D49AA9":"Xiaomi","D4970B":"Xiaomi",
  "D89868":"Xiaomi","E0CCF8":"Xiaomi","F0B429":"Xiaomi","F48B52":"Xiaomi","F87988":"Xiaomi","FC64BA":"Xiaomi",

  // Intel
  "001B21":"Intel","003048":"Intel","0050F2":"Intel","007048":"Intel","001320":"Intel","002170":"Intel",
  "002213":"Intel","00236F":"Intel","002369":"Intel","0026C7":"Intel","0026CC":"Intel","00AA00":"Intel",
  "040167":"Intel","080017":"Intel","0C3B5B":"Intel","0C84DC":"Intel","100BA9":"Intel","1048B1":"Intel",
  "14135E":"Intel","186099":"Intel","1C69C3":"Intel","1C1EF6":"Intel","202023":"Intel","20D3F3":"Intel",
  "247703":"Intel","24FD52":"Intel","282346":"Intel","28B2BD":"Intel","2C6B62":"Intel","30D064":"Intel",
  "307E3E":"Intel","344189":"Intel","345D9E":"Intel","38BAAB":"Intel","3C46D8":"Intel","3C970E":"Intel",
  "40F2E9":"Intel","44858B":"Intel","48F5A4":"Intel","4C5499":"Intel","4C7932":"Intel","4C79BA":"Intel",
  "5021A2":"Intel","504AC3":"Intel","5088B2":"Intel","54E1AD":"Intel","583FC1":"Intel","5C5149":"Intel",
  "60673D":"Intel","604BAA":"Intel","64718A":"Intel","6805CA":"Intel","6C3B6B":"Intel","6CF049":"Intel",
  "706496":"Intel","70F8AE":"Intel","742779":"Intel","746288":"Intel","7CC0C6":"Intel","804F58":"Intel",
  "80861A":"Intel","84A6C8":"Intel","881408":"Intel","8C70E7":"Intel","8C2090":"Intel","90E671":"Intel",
  "946B48":"Intel","A4C3F0":"Intel","A8ACC1":"Intel","AC9E17":"Intel","B4AE2B":"Intel","BCEE7B":"Intel",
  "C04A00":"Intel","C0F2FB":"Intel","C8B366":"Intel","D8FC93":"Intel","D8B4B4":"Intel","DC530A":"Intel",
  "E0940F":"Intel","E45A37":"Intel","E4F99C":"Intel","F0174E":"Intel","F0D5BF":"Intel","F8D0AC":"Intel",
  "FC775A":"Intel",

  // Cisco
  "000000":"Cisco","000142":"Cisco","000E38":"Cisco","000E83":"Cisco","000F8F":"Cisco","001185":"Cisco",
  "0013C4":"Cisco","001640":"Cisco","00173B":"Cisco","001966":"Cisco","001A2F":"Cisco","001CA1":"Cisco",
  "001D70":"Cisco","001E49":"Cisco","0021A0":"Cisco","002199":"Cisco","00228B":"Cisco","0023EA":"Cisco",
  "002611":"Cisco","001120":"Cisco","0C5AF4":"Cisco","106F3F":"Cisco","1480C2":"Cisco","14F69E":"Cisco",
  "186472":"Cisco","1CAA07":"Cisco","1CD168":"Cisco","2009D8":"Cisco","2079C1":"Cisco","2090B3":"Cisco",
  "24790A":"Cisco","285F3F":"Cisco","34DB9E":"Cisco","3C5731":"Cisco","400DA3":"Cisco","44ADC5":"Cisco",
  "4C0082":"Cisco","502558":"Cisco","54A24F":"Cisco","58AC78":"Cisco","5CB936":"Cisco","6480B9":"Cisco",
  "64D814":"Cisco","6803E2":"Cisco","6CBEF5":"Cisco","6CE998":"Cisco","6CFA89":"Cisco","703D15":"Cisco",
  "74865A":"Cisco","74A0B1":"Cisco","74A069":"Cisco","780CCD":"Cisco","7CB21B":"Cisco","8478AC":"Cisco",
  "84B8C8":"Cisco","88F032":"Cisco","8C8D28":"Cisco","906BDE":"Cisco","90F52B":"Cisco","985D9E":"Cisco",
  "9C178C":"Cisco","9CB654":"Cisco","A0534E":"Cisco","A0F8A9":"Cisco","A45636":"Cisco","A49496":"Cisco",
  "A4C3DF":"Cisco","A84EC6":"Cisco","AC7EA6":"Cisco","B0AA77":"Cisco","B0C5CA":"Cisco","B47863":"Cisco",
  "B8627C":"Cisco","B8AF67":"Cisco","BC9FFF":"Cisco","C0801F":"Cisco","C08C60":"Cisco","C46340":"Cisco",
  "C47D4F":"Cisco","C8C960":"Cisco","C89C1D":"Cisco","CC46D6":"Cisco","D0574B":"Cisco","D08E79":"Cisco",
  "D48564":"Cisco","D4A0CA":"Cisco","D8243D":"Cisco","D8B19E":"Cisco","DCF78C":"Cisco","E04F43":"Cisco",
  "E4AA5D":"Cisco","E8B748":"Cisco","ECE1A9":"Cisco","F01081":"Cisco","F01497":"Cisco","F41F0A":"Cisco",
  "F44E38":"Cisco","F47B5E":"Cisco","F4BD9E":"Cisco","F8E04B":"Cisco","FC5B39":"Cisco","FC9924":"Cisco",

  // Raspberry Pi
  "28CDA4":"Raspberry Pi","2CCF67":"Raspberry Pi","B827EB":"Raspberry Pi","D83ADD":"Raspberry Pi",
  "E45F01":"Raspberry Pi",

  // Google
  "001A11":"Google","3C5AB4":"Google","48D6D5":"Google","54F23D":"Google","606D3C":"Google","6C5AB5":"Google",
  "70B3D5":"Google","94EB2C":"Google","A47733":"Google","F4F5DB":"Google","1C1B68":"Google",

  // Google Nest
  "18B4D7":"Google Nest","200DB0":"Google Nest","30FD38":"Google Nest","E4F0B5":"Google Nest",
  "FC481D":"Google Nest",

  // Chromecast
  "6C5C89":"Chromecast",

  // Amazon
  "0C47C9":"Amazon","38F73D":"Amazon","4CEFA7":"Amazon","50F5DA":"Amazon","68037B":"Amazon","74C246":"Amazon",
  "84D6D0":"Amazon","8871E5":"Amazon","A002DC":"Amazon","B47C9C":"Amazon","CC9EE4":"Amazon","D4F25F":"Amazon",
  "F0D2F1":"Amazon","F0272D":"Amazon","FC65DE":"Amazon",

  // Microsoft
  "000D3A":"Microsoft","001DD8":"Microsoft","0017FA":"Microsoft","00155D":"Microsoft","00224E":"Microsoft",
  "008E9B":"Microsoft","0C5A07":"Microsoft","1C1B0D":"Microsoft","28183C":"Microsoft","28F8CA":"Microsoft",
  "485073":"Microsoft","48AFF7":"Microsoft","50E549":"Microsoft","5CE0C5":"Microsoft","60451D":"Microsoft",
  "70BD5B":"Microsoft","7C1E52":"Microsoft","8483E1":"Microsoft","880A3C":"Microsoft","902EC7":"Microsoft",
  "981B7E":"Microsoft","A0E529":"Microsoft","C0BA35":"Microsoft","C4093E":"Microsoft","CC6AE8":"Microsoft",
  "DC21E2":"Microsoft","E04D6A":"Microsoft","E0675A":"Microsoft","F09026":"Microsoft",

  // Dell
  "000874":"Dell","001372":"Dell","0013E8":"Dell","001E4F":"Dell","00219B":"Dell","002564":"Dell","1E72E7":"Dell",
  "20047B":"Dell","24B6FD":"Dell","34E6D7":"Dell","381065":"Dell","3C2C30":"Dell","44A842":"Dell","484DE2":"Dell",
  "4C5A5B":"Dell","54BF64":"Dell","688AE2":"Dell","6CB311":"Dell","74867A":"Dell","78D32E":"Dell","84CBC4":"Dell",
  "848D59":"Dell","98903C":"Dell","9CB70D":"Dell","A4BADB":"Dell","B083FE":"Dell","B421A0":"Dell","B8AC6F":"Dell",
  "C0EEBD":"Dell","C81F28":"Dell","D067E5":"Dell","D497AC":"Dell","DCED42":"Dell","E091F5":"Dell","F8A963":"Dell",
  "F8B156":"Dell","FCCFE9":"Dell",

  // HP
  "000C29":"HP","001321":"HP","001560":"HP","0018FE":"HP","001A4B":"HP","001E0B":"HP","001F29":"HP","00245A":"HP",
  "002655":"HP","00ABCD":"HP","001871":"HP","101FAA":"HP","10604B":"HP","1CC1DE":"HP","24692B":"HP","2C44FD":"HP",
  "3C4A92":"HP","3CD92B":"HP","485B39":"HP","505064":"HP","609C9F":"HP","641C67":"HP","6C3BE5":"HP","6CE38A":"HP",
  "741547":"HP","78480F":"HP","84B135":"HP","88CE7D":"HP","8C8C73":"HP","909B6C":"HP","942741":"HP","9CB8AD":"HP",
  "A0C5F2":"HP","ACE2D3":"HP","B4B686":"HP","BC5FF4":"HP","C41328":"HP","C4F379":"HP","D84FB8":"HP","D8D3E5":"HP",
  "DCCFA7":"HP","E0D1E5":"HP","E403C4":"HP","E4E7AD":"HP","E8039A":"HP","EC8EB5":"HP","F4CE46":"HP","F4F2C7":"HP",
  "F824F8":"HP","FCECDA":"HP",

  // Lenovo
  "000EE3":"Lenovo","10BE12":"Lenovo","105016":"Lenovo","189C27":"Lenovo","1C48AC":"Lenovo","28D244":"Lenovo",
  "3025AA":"Lenovo","4CB741":"Lenovo","5404A6":"Lenovo","542583":"Lenovo","5CF9DD":"Lenovo","6038EE":"Lenovo",
  "60D99F":"Lenovo","6CAD5C":"Lenovo","6CBD3B":"Lenovo","747927":"Lenovo","800022":"Lenovo","84978A":"Lenovo",
  "889B39":"Lenovo","90485C":"Lenovo","907E41":"Lenovo","98FA9B":"Lenovo","9C93E5":"Lenovo","A40CA7":"Lenovo",
  "ACB6E8":"Lenovo","B05BE0":"Lenovo","B09120":"Lenovo","C4736B":"Lenovo","C81A27":"Lenovo","D4C9EF":"Lenovo",
  "D8FD86":"Lenovo","E0D55E":"Lenovo","E8B482":"Lenovo","F0DEF1":"Lenovo","F4898F":"Lenovo","F48E38":"Lenovo",
  "F83EF2":"Lenovo","F8A2D6":"Lenovo",

  // Sony
  "0013A9":"Sony","001A80":"Sony","001BE3":"Sony","001D0D":"Sony","001E68":"Sony","0021E8":"Sony","00241A":"Sony",
  "0025E7":"Sony","0026CE":"Sony","001C59":"Sony","001CEA":"Sony","081B9A":"Sony","1085FF":"Sony","18002D":"Sony",
  "2CAB25":"Sony","30EA28":"Sony","34C37A":"Sony","38E754":"Sony","40B89A":"Sony","549E97":"Sony","5C614F":"Sony",
  "64D499":"Sony","703AB8":"Sony","7C1F00":"Sony","80117B":"Sony","8CF548":"Sony","9001A1":"Sony","9C5C8D":"Sony",
  "A04E3F":"Sony","ACE9D4":"Sony","B42B23":"Sony","B4524A":"Sony","BC8083":"Sony","DC0B34":"Sony","E04136":"Sony",
  "E08E2C":"Sony","E84ED6":"Sony","F0631A":"Sony","FC0FE6":"Sony",

  // Nintendo
  "000995":"Nintendo","001656":"Nintendo","001781":"Nintendo","001F32":"Nintendo","002659":"Nintendo",
  "0009BF":"Nintendo","002444":"Nintendo","0017AB":"Nintendo","002709":"Nintendo","002FD0":"Nintendo",
  "40F407":"Nintendo","4C2F5D":"Nintendo","582F40":"Nintendo","7CB5A5":"Nintendo","8C56C5":"Nintendo",
  "9CD8E4":"Nintendo","A438CC":"Nintendo","B8AE6E":"Nintendo","C8B9A7":"Nintendo","CC9E00":"Nintendo",
  "D86BF7":"Nintendo","E84ECE":"Nintendo","F45E0B":"Nintendo",

  // ASUS
  "000C6E":"ASUS","049226":"ASUS","048D38":"ASUS","08606E":"ASUS","0C9D92":"ASUS","10BF48":"ASUS","1C872C":"ASUS",
  "20CF30":"ASUS","2C56DC":"ASUS","2CFDA1":"ASUS","30AB6A":"ASUS","38D547":"ASUS","3CFFEE":"ASUS","40167E":"ASUS",
  "40E230":"ASUS","485216":"ASUS","48F8B3":"ASUS","4C2529":"ASUS","5029CB":"ASUS","5CE927":"ASUS","60A44C":"ASUS",
  "689514":"ASUS","6CED12":"ASUS","74D02B":"ASUS","788A20":"ASUS","7C10C9":"ASUS","88D7F6":"ASUS","90E6BA":"ASUS",
  "98EEF0":"ASUS","9C5C8E":"ASUS","A036BC":"ASUS","A85E45":"ASUS","AC220B":"ASUS","B06EBF":"ASUS","B4B524":"ASUS",
  "BC1A9A":"ASUS","C8B9E8":"ASUS","CA9FB6":"ASUS","D06312":"ASUS","D06726":"ASUS","D86C63":"ASUS","DC4F22":"ASUS",
  "E07D97":"ASUS","E8B48E":"ASUS","ECB1D7":"ASUS","F07BCB":"ASUS","F83A02":"ASUS","F8367B":"ASUS","FCAA14":"ASUS",

  // TP-Link
  "000AEB":"TP-Link","001000":"TP-Link","001325":"TP-Link","10BEF5":"TP-Link","14CF92":"TP-Link",
  "1C61B4":"TP-Link","20DC93":"TP-Link","2401F6":"TP-Link","244BEB":"TP-Link","284D02":"TP-Link",
  "2C23EB":"TP-Link","30B5C2":"TP-Link","34E894":"TP-Link","3C4606":"TP-Link","3C521A":"TP-Link",
  "440019":"TP-Link","48EE0C":"TP-Link","50C7BF":"TP-Link","50FA84":"TP-Link","54A7CA":"TP-Link",
  "5C628B":"TP-Link","5CB351":"TP-Link","60A4D0":"TP-Link","60E327":"TP-Link","686179":"TP-Link",
  "7002DC":"TP-Link","706F81":"TP-Link","74DADA":"TP-Link","74EA3A":"TP-Link","788CB5":"TP-Link",
  "7C8BCA":"TP-Link","84163C":"TP-Link","90F65B":"TP-Link","940F1B":"TP-Link","983869":"TP-Link",
  "9C214F":"TP-Link","9CB9D0":"TP-Link","A0AB1B":"TP-Link","A42BB0":"TP-Link","A6B5B7":"TP-Link",
  "ACA90A":"TP-Link","B0487A":"TP-Link","B09B95":"TP-Link","B4E442":"TP-Link","B8A1FC":"TP-Link",
  "C006C3":"TP-Link","C0A0BB":"TP-Link","C46E1F":"TP-Link","C84FE1":"TP-Link","CCA223":"TP-Link",
  "D03729":"TP-Link","D4CA6D":"TP-Link","D83296":"TP-Link","DC9FDB":"TP-Link","DCFE18":"TP-Link",
  "E03276":"TP-Link","E047C7":"TP-Link","E0A3AC":"TP-Link","E29F28":"TP-Link","E4D332":"TP-Link",
  "E8DED6":"TP-Link","EC172F":"TP-Link","EC886C":"TP-Link","ECA9A7":"TP-Link","F0A731":"TP-Link",
  "F4F26D":"TP-Link","F81A67":"TP-Link","FA8FCA":"TP-Link",

  // Netgear
  "001B2F":"Netgear","001E2A":"Netgear","001F33":"Netgear","002196":"Netgear","002275":"Netgear",
  "00238E":"Netgear","0026F2":"Netgear","00286C":"Netgear","004016":"Netgear","006043":"Netgear",
  "08028E":"Netgear","08BD43":"Netgear","10DA43":"Netgear","24F5A2":"Netgear","28C68E":"Netgear",
  "2CD02D":"Netgear","346895":"Netgear","3C3786":"Netgear","44944B":"Netgear","4C09D4":"Netgear",
  "58EF68":"Netgear","5C5969":"Netgear","6038E0":"Netgear","6CB066":"Netgear","6CCDCB":"Netgear",
  "74448E":"Netgear","7C344D":"Netgear","807FB5":"Netgear","848F69":"Netgear","9C3DCF":"Netgear",
  "A020A6":"Netgear","A040A0":"Netgear","A42364":"Netgear","B00BD0":"Netgear","C0FF2B":"Netgear",
  "C4F63A":"Netgear","C867AF":"Netgear","CC40D0":"Netgear","D02D48":"Netgear","D03772":"Netgear",
  "D46497":"Netgear","E090AC":"Netgear","E4F4C6":"Netgear","E84DC8":"Netgear","EC227B":"Netgear",
  "F04F7C":"Netgear","F08CFB":"Netgear","F42E1F":"Netgear",

  // Ubiquiti
  "002722":"Ubiquiti","0418D6":"Ubiquiti","043197":"Ubiquiti","24A43C":"Ubiquiti","44D9E7":"Ubiquiti",
  "68722D":"Ubiquiti","687217":"Ubiquiti","80E01D":"Ubiquiti","B4FBE4":"Ubiquiti","E063DA":"Ubiquiti",
  "F09FC2":"Ubiquiti","F4E2C6":"Ubiquiti",

  // MikroTik
  "001AEB":"MikroTik","2CC8E9":"MikroTik","48A97A":"MikroTik","4C5E0C":"MikroTik","74AD0A":"MikroTik",
  "B8069F":"MikroTik","C4AD34":"MikroTik","CC2DE0":"MikroTik","DC2C6E":"MikroTik","E48D8C":"MikroTik",

  // VMware
  "000569":"VMware","001C14":"VMware","005056":"VMware",

  // VirtualBox
  "080027":"VirtualBox",

  // Parallels
  "001C42":"Parallels",

  // Espressif
  "18FE34":"Espressif","240AC4":"Espressif","2CF432":"Espressif","30AEA4":"Espressif","3C71BF":"Espressif",
  "48E72A":"Espressif","4CEBD6":"Espressif","5CCF7F":"Espressif","60019F":"Espressif","68C63A":"Espressif",
  "70039F":"Espressif","7CDFA1":"Espressif","84CCA8":"Espressif","84F3EB":"Espressif","8CAAB5":"Espressif",
  "90971C":"Espressif","A0203C":"Espressif","A09368":"Espressif","A4CF12":"Espressif","A8032A":"Espressif",
  "AC0BFB":"Espressif","B0B91F":"Espressif","B4E62D":"Espressif","B8F009":"Espressif","BC0500":"Espressif",
  "C44F33":"Espressif","C8C9A3":"Espressif","CC50E3":"Espressif","D8F15B":"Espressif","E0E2E6":"Espressif",
  "E8DB84":"Espressif","EC62B8":"Espressif","F4CFA2":"Espressif","F8F005":"Espressif","FCCA28":"Espressif",

  // TI
  "000D88":"TI","001234":"TI","00124B":"TI","002335":"TI","003706":"TI","0050C2":"TI","0800EB":"TI","18B169":"TI",
  "1C6B33":"TI","34039E":"TI","346DC4":"TI","489FE4":"TI","54524A":"TI","68C90B":"TI","A840A6":"TI",

  // Broadcom
  "000AF7":"Broadcom","00904C":"Broadcom","286596":"Broadcom","4C17EB":"Broadcom",

  // Qualcomm
  "000AF5":"Qualcomm","009001":"Qualcomm","00F028":"Qualcomm","0402FC":"Qualcomm",

  // OnePlus
  "0800B2":"OnePlus","086BC7":"OnePlus","0C5EBC":"OnePlus","185937":"OnePlus","24DF6A":"OnePlus",
  "345345":"OnePlus","3896AD":"OnePlus","506067":"OnePlus","6CF374":"OnePlus","84F703":"OnePlus",
  "A00808":"OnePlus","AC371A":"OnePlus","C45ACA":"OnePlus","CC3D82":"OnePlus","D46A35":"OnePlus",
  "F4A773":"OnePlus",

  // OPPO
  "00188D":"OPPO","041EAF":"OPPO","048EA8":"OPPO","103692":"OPPO","1C1780":"OPPO","1CB17D":"OPPO","203689":"OPPO",
  "2C5BB8":"OPPO","2CE2A8":"OPPO","3022B4":"OPPO","38A4ED":"OPPO","3CC79A":"OPPO","40CB52":"OPPO","44AF28":"OPPO",
  "4CA37E":"OPPO","5006AB":"OPPO","5485D0":"OPPO","5C8D4E":"OPPO","6021CF":"OPPO","64DF0B":"OPPO","6CA56B":"OPPO",
  "7099A6":"OPPO","84A923":"OPPO","8C0DF3":"OPPO","8CB84F":"OPPO","9CC7A6":"OPPO","9CDEC9":"OPPO","A4F1EF":"OPPO",
  "A65CF8":"OPPO","A8DB03":"OPPO","AC567E":"OPPO","AC63BE":"OPPO","B01F81":"OPPO","B4B67A":"OPPO","B8F2BB":"OPPO",
  "BC7739":"OPPO","BCC496":"OPPO","C413CA":"OPPO","C4AC59":"OPPO","C8338A":"OPPO","CC898B":"OPPO","D0C87A":"OPPO",
  "D41B81":"OPPO","D8B9AB":"OPPO","D8EB97":"OPPO","DC6832":"OPPO","E034A0":"OPPO","E4A4C4":"OPPO","ECDFAB":"OPPO",
  "F022AB":"OPPO","F062AC":"OPPO","F462B8":"OPPO","F85B3B":"OPPO","FCA135":"OPPO",

  // LG
  "000C43":"LG","000FE2":"LG","001E75":"LG","00AA94":"LG","082345":"LG","10F1F2":"LG","1C088A":"LG","1CE62B":"LG",
  "24C6AC":"LG","280E5A":"LG","2CA38B":"LG","308234":"LG","3C8C93":"LG","40DC92":"LG","4C22C4":"LG","5C4986":"LG",
  "6C400B":"LG","6C9270":"LG","78577B":"LG","7C66EF":"LG","80AC33":"LG","88C9D0":"LG","98076B":"LG","A0D05E":"LG",
  "A8B9F8":"LG","AC8F5A":"LG","B4179B":"LG","B88BAD":"LG","BC1F9A":"LG","C0DC41":"LG","C09D39":"LG","C8C3C1":"LG",
  "CC2D00":"LG","D055D5":"LG","D477B7":"LG","D87E1D":"LG","DC97B6":"LG","F0A2B8":"LG","F4D09B":"LG",

  // Canon
  "00059A":"Canon","001BFC":"Canon","001C2A":"Canon","001E8F":"Canon","002247":"Canon","0025A5":"Canon",
  "08D06F":"Canon","1C87F5":"Canon","3C2AF4":"Canon","404BBE":"Canon","50562A":"Canon","54B80A":"Canon",
  "588D7A":"Canon","5C3B73":"Canon","5C906C":"Canon","5CBA37":"Canon","605688":"Canon","64A66A":"Canon",
  "748DC3":"Canon","74D0DC":"Canon","88777D":"Canon","90CA93":"Canon","98B98D":"Canon","98DCAB":"Canon",
  "9CB668":"Canon","A4F6E5":"Canon","ACA08F":"Canon","B4EAC2":"Canon","BC0DEA":"Canon","BC0E68":"Canon",
  "C06E08":"Canon","C87D6B":"Canon","CC6BDE":"Canon","D048B5":"Canon","D8A4BF":"Canon","E85CF3":"Canon",
  "ECB82A":"Canon","F4CCDB":"Canon","F8A16B":"Canon",

  // Epson
  "001083":"Epson","0026AB":"Epson","101E60":"Epson","1CB72C":"Epson","2019A8":"Epson","244CE3":"Epson",
  "34BA48":"Epson","44D28B":"Epson","5092F2":"Epson","5484CB":"Epson","6497A9":"Epson","6CB3F5":"Epson",
  "7CA13E":"Epson","8C5440":"Epson","94CCB9":"Epson","AC18A6":"Epson","B0E7BF":"Epson","C48BB4":"Epson",
  "D8E349":"Epson","E8B9B2":"Epson","EC2D13":"Epson","F04E40":"Epson","F45296":"Epson","F86CE5":"Epson",

  // Brother
  "00809B":"Brother","001BA9":"Brother","047D74":"Brother","18EF63":"Brother","1C3EE5":"Brother",
  "3065EC":"Brother","508B42":"Brother","58999B":"Brother","64DBE0":"Brother","6C8D77":"Brother",
  "7C1F80":"Brother","84C7D9":"Brother","A4179B":"Brother","B47D4F":"Brother","E09D31":"Brother",

  // Roku
  "085D51":"Roku","105C26":"Roku","205D47":"Roku","4CA7BD":"Roku","645AED":"Roku","8C227D":"Roku","940C6D":"Roku",
  "A8C2F4":"Roku","B074E2":"Roku","BC68B3":"Roku","CC6DA0":"Roku","D4E59A":"Roku","DC3A5E":"Roku","E8155A":"Roku",
  "F8E695":"Roku",

  // Philips
  "001788":"Philips","000722":"Philips","0CA42A":"Philips","ECB5FA":"Philips",

  // Signify
  "7CE524":"Signify","00178A":"Signify",
};

export function lookupVendor(mac: string): string {
  if (!mac) return "Unknown";
  const key = mac.replace(/[:-]/g, "").substring(0, 6).toUpperCase();
  return OUI[key] ?? "Unknown";
}
