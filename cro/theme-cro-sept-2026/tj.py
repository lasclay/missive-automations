import json,re,sys
def load(p):
    s=open(p).read()
    s=re.sub(r'^\s*/\*.*?\*/\s*','',s,flags=re.S)
    return json.loads(s)
def dump(p):
    t=load(p)
    for k,v in t['sections'].items():
        print('SECTION',k,v.get('type'))
        for bk,b in (v.get('blocks') or {}).items():
            s=b.get('settings',{})
            short={kk:(vv[:220] if isinstance(vv,str) else vv) for kk,vv in s.items()}
            print('  ',bk,b.get('type'),json.dumps(short,ensure_ascii=False))
        if v.get('block_order'): print('  order',v.get('block_order'))
        print('  settings',json.dumps({k:(v[:160] if isinstance(v,str) else v) for k,v in v.get('settings',{}).items()},ensure_ascii=False))
    print('ORDER',t.get('order'))
if __name__=='__main__':
    for p in sys.argv[1:]:
        print('=====',p); dump(p)
