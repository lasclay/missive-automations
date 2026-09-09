import asyncio, json, sys, glob, os
from playwright.async_api import async_playwright
URLS={"accueil":"https://lasclay.com/","collection":"https://lasclay.com/collections/mitaines","fiche":"https://lasclay.com/products/mittens"}
exe=None
for c in glob.glob('/opt/pw-browsers/chromium*/chrome-linux*/chrome'): exe=c
async def run():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=exe, args=["--no-sandbox"], proxy={"server": os.environ.get("HTTPS_PROXY","")})
        res={}
        for name,url in URLS.items():
            ctx=await b.new_context(viewport={"width":390,"height":844},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",locale="fr-CA")
            cdp=await ctx.new_cdp_session(await ctx.new_page()) if False else None
            page=await ctx.new_page()
            client=await ctx.new_cdp_session(page)
            await client.send("Network.emulateNetworkConditions",{"offline":False,"latency":150,"downloadThroughput":1.6*1024*1024/8,"uploadThroughput":750*1024/8})
            await client.send("Emulation.setCPUThrottlingRate",{"rate":4})
            reqs=[]; page.on("request", lambda r: reqs.append(r.url))
            await page.add_init_script("""window.__lcp=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__lcp=e.startTime}}).observe({type:'largest-contentful-paint',buffered:true});
window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value}}).observe({type:'layout-shift',buffered:true});""")
            try:
                await page.goto(url, wait_until="load", timeout=90000)
                await page.wait_for_timeout(6000)
                m=await page.evaluate("""()=>{const n=performance.getEntriesByType('navigation')[0];const fcp=performance.getEntriesByName('first-contentful-paint')[0];const r=performance.getEntriesByType('resource');const bytes=r.reduce((a,x)=>a+(x.transferSize||0),0);const hosts=new Set(r.map(x=>{try{return new URL(x.name).host}catch(e){return ''}}));return {ttfb:n.responseStart,fcp:fcp?fcp.startTime:null,lcp:window.__lcp,cls:window.__cls,domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd,resources:r.length,transferKB:Math.round(bytes/1024),hosts:hosts.size,scripts:r.filter(x=>x.initiatorType==='script').length}}""")
                m['requests_total']=len(reqs); res[name]=m
            except Exception as e:
                res[name]={"error":str(e)[:200]}
            await ctx.close()
        await b.close()
        print(json.dumps(res,indent=1))
asyncio.run(run())
