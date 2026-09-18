import { afterEach,describe,expect,it,vi } from 'vitest'
import { LocalRepository } from '../data/localRepository'
import { updateLatestSecurityPrices } from './priceUpdates'

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
})
