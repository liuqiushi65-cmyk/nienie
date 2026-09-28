#import <Carbon/Carbon.h>
#include <assert.h>
// 只测试原生事件路由，不发送系统输入，也不创建应用窗口。
#define main nienieApplicationMain
#import "../app/native/main.m"
#undef main

@interface HotKeySpy : AppDelegate
@property NSUInteger toggleCount;
@end
@implementation HotKeySpy
- (void)toggle { self.toggleCount++; }
@end

static EventRef keyEvent(UInt32 kind, UInt32 signature, UInt32 identifier) {
    EventRef event=NULL;
    assert(CreateEvent(NULL,kEventClassKeyboard,kind,0,kEventAttributeNone,&event)==noErr);
    EventHotKeyID key={signature,identifier};
    assert(SetEventParameter(event,kEventParamDirectObject,typeEventHotKeyID,sizeof(key),&key)==noErr);
    return event;
}
int main(void) { @autoreleasepool {
    NSString *thread=@"01a0c7eb-8e5d-7822-84f4-b204ca59fb09";
    assert([NienieThreadURL(thread).absoluteString isEqualToString:[@"codex://threads/" stringByAppendingString:thread]]);
    for(id invalid in @[@"",@"https://example.com",@"01a0c7eb-8e5d-7822-84f4-b204ca59fb09?view=review",@42,NSNull.null])assert(NienieThreadURL(invalid)==nil);
    HotKeySpy *spy=[HotKeySpy new];
    EventRef release=keyEvent(kEventHotKeyReleased,'NNIE',1);
    assert(HandleNienieHotKey(NULL,release,(__bridge void *)spy)==noErr);
    assert(spy.toggleCount==1);
    assert(HandleNienieHotKey(NULL,release,(__bridge void *)spy)==noErr);
    assert(spy.toggleCount==2);
    ReleaseEvent(release);
    for(int i=0;i<3;i++) {
        EventRef other=keyEvent(i==0?kEventHotKeyPressed:kEventHotKeyReleased,i==1?'OTHR':'NNIE',i==2?2:1);
        assert(HandleNienieHotKey(NULL,other,(__bridge void *)spy)==eventNotHandledErr);
        assert(spy.toggleCount==2);
        ReleaseEvent(other);
    }
    EventRef missing=NULL;
    assert(CreateEvent(NULL,kEventClassKeyboard,kEventHotKeyReleased,0,kEventAttributeNone,&missing)==noErr);
    assert(HandleNienieHotKey(NULL,missing,(__bridge void *)spy)==eventNotHandledErr);
    assert(spy.toggleCount==2);ReleaseEvent(missing);
    puts("快捷键路由通过：两次松键各切换一次；按住重复、其他签名/编号、缺失参数均不触发。");
} return 0; }
