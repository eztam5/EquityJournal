import { afterEach,describe,expect,it,vi } from 'vitest'
import { LocalRepository } from '../data/localRepository'
import { catchUpMissingSecurityPrices, ensureSecurityPriceHistory, updateLatestSecurityPrices } from './priceUpdates'

describe('scheduled price updates',()=>{
  afterEach(()=>localStorage.clear())

  it('fetches only recent prices and upserts the newest trading day without removing history',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AMR','USD',[{priceDate:'2026-09-17',close:180,adjustedClose:180}])
    const fetcher=vi.fn().mockResolvedValue({symbol:'AMR',currency:'USD',exchangeName:'NYQ',timeZone:'America/New_York',companyName:'Alpha Metallurgical Resources, Inc.',prices:[{timestamp:Date.UTC(2026,8,18,20)/1000,close:182,adjustedClose:182}]})

    const result=await updateLatestSecurityPrices(repository,[security],fetcher)

    expect(fetcher).toHaveBeenCalledWith('AMR','1d')
    expect(result).toEqual({updatedSecurityIds:[security.id],failures:[]})
    expect((await repository.listSecurityPrices(security.id)).map((price)=>[price.priceDate,price.close])).toEqual([['2026-09-17',180],['2026-09-18',182]])
  })

  it('continues updating other securities when one symbol fails',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const first=await repository.addSecurity({symbol:'BAD',name:'Bad symbol',currency:'USD'}),second=await repository.addSecurity({symbol:'AAPL',name:'Apple',currency:'USD'})
    const fetcher=vi.fn().mockRejectedValueOnce(new Error('Not found')).mockResolvedValueOnce({symbol:'AAPL',currency:'USD',exchangeName:'NMS',timeZone:'America/New_York',companyName:'Apple Inc.',prices:[{timestamp:Date.UTC(2026,8,18,20)/1000,close:250,adjustedClose:250}]})

    const result=await updateLatestSecurityPrices(repository,[first,second],fetcher)

    expect(result.updatedSecurityIds).toEqual([second.id])
    expect(result.failures).toEqual([{securityId:first.id,symbol:'BAD',message:'Not found'}])
    expect(await repository.listSecurityPrices(second.id)).toHaveLength(1)
  })

  it('loads full history when a security has only the latest scheduled price',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AMR','USD',[{priceDate:'2026-09-18',close:182,adjustedClose:182}])
    const fetcher=vi.fn().mockResolvedValue({symbol:'AMR',currency:'USD',exchangeName:'NYQ',timeZone:'America/New_York',companyName:'Alpha Metallurgical Resources, Inc.',prices:[{timestamp:Date.UTC(2026,8,17,20)/1000,close:180,adjustedClose:180},{timestamp:Date.UTC(2026,8,18,20)/1000,close:182,adjustedClose:182}]})

    expect(await ensureSecurityPriceHistory(repository,security,fetcher)).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('AMR','10y')
    expect((await repository.listSecurityPrices(security.id)).map((price)=>price.priceDate)).toEqual(['2026-09-17','2026-09-18'])
  })

  it('does not reload history when enough prices are already cached',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AMR','USD',[{priceDate:'2026-09-17',close:180,adjustedClose:180},{priceDate:'2026-09-18',close:182,adjustedClose:182}])
    const fetcher=vi.fn()

    expect(await ensureSecurityPriceHistory(repository,security,fetcher)).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fills missing recent trading days at startup with a small history request',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AMR','USD',[{priceDate:'2026-09-14',close:174,adjustedClose:174},{priceDate:'2026-09-15',close:175,adjustedClose:175}])
    const fetcher=vi.fn().mockResolvedValue({symbol:'AMR',currency:'USD',exchangeName:'NYQ',timeZone:'America/New_York',companyName:'Alpha Metallurgical Resources, Inc.',prices:[{timestamp:Date.UTC(2026,8,16,20)/1000,close:178,adjustedClose:178},{timestamp:Date.UTC(2026,8,17,20)/1000,close:180,adjustedClose:180},{timestamp:Date.UTC(2026,8,18,20)/1000,close:182,adjustedClose:182}]})

    const result=await catchUpMissingSecurityPrices(repository,[security],'2026-09-18',fetcher)

    expect(fetcher).toHaveBeenCalledWith('AMR','1mo')
    expect(result).toEqual({updatedSecurityIds:[security.id],failures:[]})
    expect((await repository.listSecurityPrices(security.id)).map((price)=>price.priceDate)).toEqual(['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18'])
  })

  it('skips the startup history request when today is already cached',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AMR','USD',[{priceDate:'2026-09-17',close:180,adjustedClose:180},{priceDate:'2026-09-18',close:182,adjustedClose:182}])
    const fetcher=vi.fn()

    expect(await catchUpMissingSecurityPrices(repository,[security],'2026-09-18',fetcher)).toEqual({updatedSecurityIds:[],failures:[]})
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('loads full history at startup when no usable price history exists',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const empty=await repository.addSecurity({symbol:'AMR',name:'Alpha Metallurgical Resources',currency:'USD'})
    const latestOnly=await repository.addSecurity({symbol:'AAPL',name:'Apple',currency:'USD'})
    await repository.saveSecurityPrices(latestOnly.id,'AAPL','USD',[{priceDate:'2026-09-18',close:250,adjustedClose:250}])
    const history=(symbol:string)=>({symbol,currency:'USD',exchangeName:'NMS',timeZone:'America/New_York',companyName:symbol,prices:[{timestamp:Date.UTC(2026,8,17,20)/1000,close:100,adjustedClose:100},{timestamp:Date.UTC(2026,8,18,20)/1000,close:102,adjustedClose:102}]})
    const fetcher=vi.fn().mockImplementation(async(symbol:string)=>history(symbol))

    const result=await catchUpMissingSecurityPrices(repository,[empty,latestOnly],'2026-09-18',fetcher)

    expect(fetcher.mock.calls).toEqual([['AMR','10y'],['AAPL','10y']])
    expect(result.updatedSecurityIds).toEqual([empty.id,latestOnly.id])
    expect(await repository.listSecurityPrices(empty.id)).toHaveLength(2)
    expect(await repository.listSecurityPrices(latestOnly.id)).toHaveLength(2)
  })
})
