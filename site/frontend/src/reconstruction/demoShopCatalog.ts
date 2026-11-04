/** Shared USER/Admin DEMO catalogue; source fixture prices preserved. */
export function buildCatalog(){
 const fixed=["10","50","100","150","200","250","300","350","500","750","1000","1500","2000","2500","3000"];
 return [...fixed.map((amount,index)=>({sku:`EFHC_PACKAGE_${amount}`,title:`${amount} EFHCm`,description:`Демо-пакет ${amount} EFHCm`,item_type:"EFHC_PACKAGE",ton_enabled:true,usdt_enabled:true,
  methods:{TON:{price:(Number(amount)/100).toFixed(2)},USDT:{price:(Number(amount)*0.3).toFixed(2)}},
  image_url:null,category:"efhc",badge:"EFHC",status:"live",action_mode:"checkout",delivery_mode:"automatic",quantity_efhc:`${amount}.00000000`,sort_order:index*10})),
  {sku:"EFHC_PACKAGE_CUSTOM",title:"EFHCm",description:"Произвольная сумма (DEMO)",item_type:"EFHC_PACKAGE",ton_enabled:true,usdt_enabled:true,
    methods:{TON:{price:"0.01"},USDT:{price:"0.30"}},image_url:null,category:"efhc",badge:"",status:"live",action_mode:"checkout",delivery_mode:"automatic",quantity_efhc:null,sort_order:4000},
  {sku:"EFHC_VIP_NFT",title:"EFHC VIP NFT",description:"Выпуск NFT только моделируется",item_type:"NFT_VIP",ton_enabled:true,usdt_enabled:true,
    methods:{TON:{price:"100.00"},USDT:{price:"150.00"},EFHC:{price:"500.00000000"}},image_url:null,category:"vip",badge:"VIP NFT",status:"live",action_mode:"checkout",delivery_mode:"manual",quantity_efhc:null,sort_order:5000}];
}
