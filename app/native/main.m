#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <Carbon/Carbon.h>

@interface FloatingPanel : NSPanel @end
@implementation FloatingPanel
- (BOOL)canBecomeKeyWindow { return NO; }
- (BOOL)canBecomeMainWindow { return NO; }
- (BOOL)accessibilityPerformRaise { [self orderFrontRegardless]; return YES; }
- (NSString *)accessibilityRole { return NSAccessibilityWindowRole; }
- (NSString *)accessibilitySubrole { return NSAccessibilityStandardWindowSubrole; }
@end
@interface ToyWebView : WKWebView @end
@implementation ToyWebView
- (BOOL)acceptsFirstMouse:(NSEvent *)event { return YES; }
@end
@interface AppDelegate : NSObject <NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property FloatingPanel *panel;
@property ToyWebView *web;
@property NSStatusItem *menuItem;
@property NSTimer *mouseTimer;
@property NSTimer *bridgeTimer;
@property NSTimer *animationTimer;
@property NSArray<NSValue *> *rects;
@property NSURL *root;
@property NSString *preferredSession;
@property BOOL ready;
@property BOOL captured;
@property BOOL diagnostics;
@property BOOL frameInFlight;
@property pid_t lastFrontPID;
@property (assign) EventHotKeyRef hotKeyRef;
@property (assign) EventHandlerRef hotKeyHandler;
@property OSStatus hotKeyStatus;
- (void)toggle;
@end

// 只允许打开任务 UUID，不接受来自网页的任意 URL 或命令。
static NSURL *NienieThreadURL(id session) {
    if(![session isKindOfClass:NSString.class] || [session length]!=36 || ![[NSUUID alloc] initWithUUIDString:session])return nil;
    return [NSURL URLWithString:[@"codex://threads/" stringByAppendingString:session]];
}
static const EventHotKeyID NienieHotKeyID={'NNIE',1};
static OSStatus HandleNienieHotKey(EventHandlerCallRef handler,EventRef event,void *context) {
    // 松键才切换，长按快捷键不会因键盘重复而反复闪现。
    if(GetEventClass(event)!=kEventClassKeyboard || GetEventKind(event)!=kEventHotKeyReleased)return eventNotHandledErr;
    EventHotKeyID key={0};
    if(GetEventParameter(event,kEventParamDirectObject,typeEventHotKeyID,NULL,sizeof(key),NULL,&key)!=noErr)return eventNotHandledErr;
    if(key.signature!=NienieHotKeyID.signature || key.id!=NienieHotKeyID.id)return eventNotHandledErr;
    [(__bridge AppDelegate *)context toggle];
    return noErr;
}
@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSURL *resource = NSBundle.mainBundle.resourceURL;
    NSData *configData = [NSData dataWithContentsOfURL:[resource URLByAppendingPathComponent:@"config.json"]];
    NSDictionary *config = configData ? [NSJSONSerialization JSONObjectWithData:configData options:0 error:nil] : @{};
    self.root = [NSURL fileURLWithPath:config[@"project"] ?: NSFileManager.defaultManager.currentDirectoryPath];
    self.preferredSession = NSProcessInfo.processInfo.environment[@"CODEX_THREAD_ID"] ?: @"";
    self.diagnostics = [NSProcessInfo.processInfo.arguments containsObject:@"--diagnostics"];
    WKWebViewConfiguration *webConfig = [WKWebViewConfiguration new];
    [webConfig.userContentController addScriptMessageHandler:self name:@"host"];
    webConfig.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    self.web = [[ToyWebView alloc] initWithFrame:NSMakeRect(0,0,360,520) configuration:webConfig];
    [self.web setValue:@NO forKey:@"drawsBackground"];
    self.web.navigationDelegate = self;
    NSRect screen = NSScreen.mainScreen.visibleFrame;
    NSPoint origin = NSMakePoint(NSMaxX(screen)-382, NSMinY(screen)+32);
    NSString *saved = [NSUserDefaults.standardUserDefaults stringForKey:@"windowOrigin"];
    if (saved) {
        NSPoint p = NSPointFromString(saved);
        for (NSScreen *s in NSScreen.screens) if (NSIntersectsRect(s.visibleFrame, NSMakeRect(p.x,p.y,360,520))) { origin=p; screen=s.visibleFrame; break; }
    }
    origin.x=fmax(NSMinX(screen),fmin(origin.x,NSMaxX(screen)-360));
    origin.y=fmax(NSMinY(screen),fmin(origin.y,NSMaxY(screen)-520));
    self.panel = [[FloatingPanel alloc] initWithContentRect:NSMakeRect(origin.x,origin.y,360,520) styleMask:NSWindowStyleMaskBorderless|NSWindowStyleMaskNonactivatingPanel backing:NSBackingStoreBuffered defer:NO];
    self.panel.title=@"捏一会儿"; self.panel.opaque=NO; self.panel.backgroundColor=NSColor.clearColor;
    self.panel.hasShadow=NO; self.panel.level=NSFloatingWindowLevel; self.panel.hidesOnDeactivate=NO;
    self.panel.releasedWhenClosed=NO;
    self.panel.collectionBehavior=NSWindowCollectionBehaviorCanJoinAllSpaces|NSWindowCollectionBehaviorFullScreenAuxiliary;
    self.panel.contentView=self.web; self.panel.ignoresMouseEvents=YES;
    [self.web loadFileURL:[resource URLByAppendingPathComponent:@"web/index.html"] allowingReadAccessToURL:[resource URLByAppendingPathComponent:@"web"]];
    [self.panel orderFrontRegardless];
    self.menuItem=[NSStatusBar.systemStatusBar statusItemWithLength:NSSquareStatusItemLength];
    self.menuItem.button.image=[NSImage imageWithSystemSymbolName:@"hand.draw" accessibilityDescription:@"捏一会儿"];
    NSMenu *menu=[NSMenu new];
    [menu addItemWithTitle:@"显示 / 隐藏捏捏  ⌃⌥N" action:@selector(toggle) keyEquivalent:@""];
    [menu addItemWithTitle:@"Codex 连接说明" action:@selector(setup) keyEquivalent:@""];
    [menu addItem:NSMenuItem.separatorItem];
    [menu addItemWithTitle:@"退出捏一会儿" action:@selector(quit) keyEquivalent:@"q"];
    for (NSMenuItem *item in menu.itemArray) item.target=self;
    self.menuItem.menu=menu;
    EventTypeSpec hotKeyEvent={kEventClassKeyboard,kEventHotKeyReleased};
    self.hotKeyStatus=InstallApplicationEventHandler(HandleNienieHotKey,1,&hotKeyEvent,(__bridge void *)self,&_hotKeyHandler);
    if(self.hotKeyStatus==noErr)self.hotKeyStatus=RegisterEventHotKey(kVK_ANSI_N,controlKey|optionKey,NienieHotKeyID,GetApplicationEventTarget(),kEventHotKeyExclusive,&_hotKeyRef);
    if(self.hotKeyStatus!=noErr){
        if(self.hotKeyHandler){RemoveEventHandler(self.hotKeyHandler);self.hotKeyHandler=NULL;}
        NSMenuItem *unavailable=[[NSMenuItem alloc] initWithTitle:@"快捷键不可用，请使用菜单显示" action:NULL keyEquivalent:@""];
        unavailable.enabled=NO;[menu insertItem:unavailable atIndex:1];
        menu.itemArray.firstObject.title=@"显示 / 隐藏捏捏";
        NSLog(@"注册全局快捷键失败：%d",(int)self.hotKeyStatus);
    }
    self.rects=@[];
    self.mouseTimer=[NSTimer scheduledTimerWithTimeInterval:1.0/30 target:self selector:@selector(updateMouse) userInfo:nil repeats:YES];
    self.mouseTimer.tolerance=.008;
    self.bridgeTimer=[NSTimer scheduledTimerWithTimeInterval:1 target:self selector:@selector(readBridge) userInfo:nil repeats:YES];
    self.bridgeTimer.tolerance=.15;
}
- (void)hidePanel {
    [self.panel orderOut:nil];[self releasePress];
    [self.web evaluateJavaScript:@"window.hostHide && window.hostHide()" completionHandler:nil];
}
- (void)toggle { if(self.panel.visible)[self hidePanel];else [self.panel orderFrontRegardless]; }
- (void)quit { [NSApp terminate:nil]; }
- (void)setup { [NSWorkspace.sharedWorkspace openURL:[self.root URLByAppendingPathComponent:@"docs/连接Codex.html"]]; }
- (void)releasePress {
    if(!self.captured)return;
    self.captured=NO;
    [self.web evaluateJavaScript:@"window.hostRelease && window.hostRelease()" completionHandler:nil];
}
- (void)drawFrame {
    if(self.frameInFlight)return;
    self.frameInFlight=YES;
    [self.web evaluateJavaScript:@"window.hostFrame && window.hostFrame(performance.now())" completionHandler:^(id result,NSError *error){self.frameInFlight=NO;}];
}
- (void)updateMouse {
    if(!self.ready || !self.panel.visible)return;
    pid_t front=NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    if(self.lastFrontPID && front!=self.lastFrontPID)[self releasePress];
    self.lastFrontPID=front;
    if(self.captured && !(NSEvent.pressedMouseButtons&1))[self releasePress];
    NSPoint screen=NSEvent.mouseLocation;
    NSPoint point=NSMakePoint(screen.x-NSMinX(self.panel.frame),NSMaxY(self.panel.frame)-screen.y);
    BOOL hit=NO;
    for(NSValue *value in self.rects)if(NSPointInRect(point,value.rectValue)){hit=YES;break;}
    self.panel.ignoresMouseEvents=!(self.captured||hit);
}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    if(![message.body isKindOfClass:NSDictionary.class])return;
    NSDictionary *body=message.body;NSString *type=body[@"type"];
    if([type isEqual:@"ready"]){self.ready=YES;[self readBridge];}
    else if([type isEqual:@"mask"]){
        NSMutableArray *rects=[NSMutableArray new];
        for(NSDictionary *r in body[@"rects"]){
            double x=[r[@"x"] doubleValue],y=[r[@"y"] doubleValue],w=[r[@"w"] doubleValue],h=[r[@"h"] doubleValue];
            if(isfinite(x)&&isfinite(y)&&w>0&&h>0)[rects addObject:[NSValue valueWithRect:NSMakeRect(x,y,w,h)]];
        }self.rects=rects;
    }
    else if([type isEqual:@"animate"]){
        if([body[@"value"] boolValue] && !self.animationTimer){
            self.animationTimer=[NSTimer timerWithTimeInterval:1.0/60 target:self selector:@selector(drawFrame) userInfo:nil repeats:YES];
            [NSRunLoop.mainRunLoop addTimer:self.animationTimer forMode:NSRunLoopCommonModes];
        }else if(![body[@"value"] boolValue]){[self.animationTimer invalidate];self.animationTimer=nil;}
    }
    else if([type isEqual:@"error"]){
        [[body[@"message"] description] writeToURL:[self.root URLByAppendingPathComponent:@".runtime/web-error.txt"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
    }
    else if([type isEqual:@"capture"])self.captured=[body[@"value"] boolValue];
    else if([type isEqual:@"hide"])[self hidePanel];
    else if([type isEqual:@"completion"])[self.panel orderFrontRegardless];
    else if([type isEqual:@"open-thread"]){
        NSURL *url=NienieThreadURL(body[@"session"]);
        BOOL opened=url && [NSWorkspace.sharedWorkspace openURL:url];
        NSDictionary *result=@{@"session":[body[@"session"] isKindOfClass:NSString.class]?body[@"session"]:@"",@"turn":[body[@"turn"] isKindOfClass:NSString.class]?body[@"turn"]:@"",@"opened":@(opened)};
        NSString *json=[[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:result options:0 error:nil] encoding:NSUTF8StringEncoding];
        [self.web evaluateJavaScript:[NSString stringWithFormat:@"window.hostThreadOpened && window.hostThreadOpened(%@)",json] completionHandler:nil];
    }
    else if([type isEqual:@"setup"])[self setup];
    else if([type isEqual:@"drag"] && NSApp.currentEvent){
        [self.panel performWindowDragWithEvent:NSApp.currentEvent];
        [NSUserDefaults.standardUserDefaults setObject:NSStringFromPoint(self.panel.frame.origin) forKey:@"windowOrigin"];
    }
}
- (void)readBridge {
    if(!self.ready)return;
    NSData *data=[NSData dataWithContentsOfURL:[self.root URLByAppendingPathComponent:@".runtime/events.json"]];
    NSMutableDictionary *object=data ? [[NSJSONSerialization JSONObjectWithData:data options:0 error:nil] mutableCopy] : [@{@"sessions":@[]} mutableCopy];
    if([object isKindOfClass:NSMutableDictionary.class]){
        object[@"preferredSession"]=self.preferredSession;
        NSData *clean=[NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
        NSString *json=[[NSString alloc] initWithData:clean encoding:NSUTF8StringEncoding];
        [self.web evaluateJavaScript:[NSString stringWithFormat:@"window.receiveBridge && window.receiveBridge(%@)",json] completionHandler:nil];
    }
    NSData *completionData=[NSData dataWithContentsOfURL:[self.root URLByAppendingPathComponent:@".runtime/completions.json"]];
    id completions=completionData?[NSJSONSerialization JSONObjectWithData:completionData options:0 error:nil]:nil;
    if([completions isKindOfClass:NSDictionary.class] && [completions[@"events"] isKindOfClass:NSArray.class]){
        NSData *clean=[NSJSONSerialization dataWithJSONObject:completions options:0 error:nil];
        NSString *json=[[NSString alloc] initWithData:clean encoding:NSUTF8StringEncoding];
        [self.web evaluateJavaScript:[NSString stringWithFormat:@"window.receiveCompletions && window.receiveCompletions(%@)",json] completionHandler:nil];
    }
    if(self.diagnostics || [NSFileManager.defaultManager fileExistsAtPath:[[self.root URLByAppendingPathComponent:@".runtime/diagnostics.enabled"] path]]){
        [self.web evaluateJavaScript:@"JSON.stringify(window.nienieSnapshot && window.nienieSnapshot())" completionHandler:^(id result,NSError *error){
            if(![result isKindOfClass:NSString.class])return;
            NSDictionary *state=@{@"snapshot":result,@"frame":NSStringFromRect(self.panel.frame),@"clickThrough":@(self.panel.ignoresMouseEvents),@"keyWindow":@(self.panel.keyWindow),@"maskCount":@(self.rects.count),@"occlusionVisible":@((self.panel.occlusionState & NSWindowOcclusionStateVisible)!=0),@"animationActive":@(self.animationTimer!=nil),@"panelVisible":@(self.panel.visible),@"hotKeyRegistered":@(self.hotKeyRef!=NULL),@"hotKeyStatus":@(self.hotKeyStatus)};
            [[NSJSONSerialization dataWithJSONObject:state options:NSJSONWritingPrettyPrinted error:nil] writeToURL:[self.root URLByAppendingPathComponent:@".runtime/native-diagnostics.json"] atomically:YES];
        }];
    }
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    decisionHandler(action.request.URL.fileURL ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}
- (void)applicationWillTerminate:(NSNotification *)notification {
    if(self.hotKeyRef)UnregisterEventHotKey(self.hotKeyRef);
    if(self.hotKeyHandler)RemoveEventHandler(self.hotKeyHandler);
    [self.mouseTimer invalidate];[self.bridgeTimer invalidate];[self.animationTimer invalidate];
}
@end
int main(int argc,const char *argv[]){@autoreleasepool{
    NSApplication *app=NSApplication.sharedApplication;
    [app setActivationPolicy:NSApplicationActivationPolicyAccessory];
    AppDelegate *delegate=[AppDelegate new];app.delegate=delegate;[app run];
}return 0;}
