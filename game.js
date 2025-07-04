// 3D抓娃娃游戏主类
class ClawMachineGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.clock = new THREE.Clock();
        
        // 游戏状态
        this.gameState = 'idle'; // idle, moving, grabbing, dropping
        this.score = 0;
        this.isGrabbing = false;
        this.gameStartTime = Date.now();
        this.gameTimeInterval = null;
        
        // 机械臂相关
        this.clawGroup = null;
        this.clawBody = null;
        this.clawPosition = { x: 0, z: 0 };
        this.clawHeight = 8;
        this.clawSpeed = 0.05;
        this.clawParts = [];
        
        // 娃娃数组
        this.toys = [];
        this.toyBodies = [];
        
        // 控制状态
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        this.init();
    }
    
    init() {
        console.log('游戏初始化开始...');
        this.setupScene();
        console.log('场景设置完成');
        this.setupPhysics();
        console.log('物理引擎设置完成');
        this.createMachine();
        console.log('机器创建完成');
        this.createClaw();
        console.log('机械臂创建完成');
        this.createToys();
        console.log('玩偶创建完成');
        this.setupControls();
        console.log('控制设置完成');
        this.setupLights();
        console.log('光照设置完成');
        this.createParticles();
        console.log('粒子效果创建完成');
        this.showGameTitle();
        this.startGameTimer();
        this.animate();
        console.log('游戏初始化完成，开始渲染循环');
    }
    
    setupScene() {
        // 创建场景
        this.scene = new THREE.Scene();
        // 创建渐变背景
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
        
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        const backgroundTexture = new THREE.CanvasTexture(canvas);
        this.scene.background = backgroundTexture;
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
        
        // 创建渲染器
        const gameCanvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: gameCanvas,
            antialias: true,
            alpha: true
        });
        
        // 获取canvas的实际尺寸
        const rect = gameCanvas.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x000000, 0); // 透明背景
        
        // 更新相机宽高比
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // 响应式调整
        window.addEventListener('resize', () => {
            const canvasElement = document.getElementById('gameCanvas');
            const canvasRect = canvasElement.getBoundingClientRect();
            const canvasWidth = canvasRect.width || 800;
            const canvasHeight = canvasRect.height || 600;
            
            this.camera.aspect = canvasWidth / canvasHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(canvasWidth, canvasHeight);
        });
    }
    
    setupPhysics() {
        try {
            // 检查CANNON是否已加载
            if (typeof CANNON === 'undefined') {
                console.error('⚠️ CANNON.js 未加载');
                return;
            }
            
            console.info('✅ Cannon 版本：', CANNON.version || '未知');
            
            // 创建物理世界
            this.world = new CANNON.World();
            this.world.gravity.set(0, -9.82, 0);
            this.world.broadphase = new CANNON.NaiveBroadphase();
        } catch (error) {
            console.error('物理引擎初始化失败:', error);
            return;
        }
        
        // 创建地面
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.add(groundBody);
        
        // 创建墙壁
        const wallMaterial = new CANNON.Material();
        
        // 前墙
        const frontWallShape = new CANNON.Box(new CANNON.Vec3(5, 5, 0.1));
        const frontWallBody = new CANNON.Body({ mass: 0 });
        frontWallBody.addShape(frontWallShape);
        frontWallBody.position.set(0, 5, 5);
        this.world.add(frontWallBody);
        
        // 后墙
        const backWallShape = new CANNON.Box(new CANNON.Vec3(5, 5, 0.1));
        const backWallBody = new CANNON.Body({ mass: 0 });
        backWallBody.addShape(backWallShape);
        backWallBody.position.set(0, 5, -5);
        this.world.add(backWallBody);
        
        // 左墙
        const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.1, 5, 5));
        const leftWallBody = new CANNON.Body({ mass: 0 });
        leftWallBody.addShape(leftWallShape);
        leftWallBody.position.set(-5, 5, 0);
        this.world.add(leftWallBody);
        
        // 右墙
        const rightWallShape = new CANNON.Box(new CANNON.Vec3(0.1, 5, 5));
        const rightWallBody = new CANNON.Body({ mass: 0 });
        rightWallBody.addShape(rightWallShape);
        rightWallBody.position.set(5, 5, 0);
        this.world.add(rightWallBody);
    }
    
    createMachine() {
        // 创建娃娃机外壳
        const machineGroup = new THREE.Group();
        
        // 机器底座 - 更厚实
        const baseGeometry = new THREE.BoxGeometry(12, 1, 12);
        const baseMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2C1810,
            shininess: 30
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -0.5;
        base.receiveShadow = true;
        base.castShadow = true;
        machineGroup.add(base);
        
        // 机器主体框架
        const frameMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFF6B35,
            shininess: 50
        });
        
        // 前框架
        const frontFrameGeometry = new THREE.BoxGeometry(10.5, 0.3, 0.3);
        const frontFrameTop = new THREE.Mesh(frontFrameGeometry, frameMaterial);
        frontFrameTop.position.set(0, 9.5, 5);
        frontFrameTop.castShadow = true;
        machineGroup.add(frontFrameTop);
        
        const frontFrameBottom = new THREE.Mesh(frontFrameGeometry, frameMaterial);
        frontFrameBottom.position.set(0, 0.5, 5);
        frontFrameBottom.castShadow = true;
        machineGroup.add(frontFrameBottom);
        
        // 侧框架
        const sideFrameGeometry = new THREE.BoxGeometry(0.3, 0.3, 10.5);
        const leftFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
        leftFrame.position.set(-5, 5, 0);
        leftFrame.castShadow = true;
        machineGroup.add(leftFrame);
        
        const rightFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
        rightFrame.position.set(5, 5, 0);
        rightFrame.castShadow = true;
        machineGroup.add(rightFrame);
        
        // 玻璃墙 - 更透明
        const glassMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff,
            transparent: true, 
            opacity: 0.15,
            roughness: 0,
            metalness: 0,
            transmission: 0.9,
            thickness: 0.1
        });
        
        // 前玻璃
        const frontGlassGeometry = new THREE.PlaneGeometry(10, 9);
        const frontGlass = new THREE.Mesh(frontGlassGeometry, glassMaterial);
        frontGlass.position.set(0, 5, 4.85);
        machineGroup.add(frontGlass);
        
        // 左玻璃
        const leftGlassGeometry = new THREE.PlaneGeometry(10, 9);
        const leftGlass = new THREE.Mesh(leftGlassGeometry, glassMaterial);
        leftGlass.position.set(-4.85, 5, 0);
        leftGlass.rotation.y = Math.PI / 2;
        machineGroup.add(leftGlass);
        
        // 右玻璃
        const rightGlass = new THREE.Mesh(leftGlassGeometry, glassMaterial);
        rightGlass.position.set(4.85, 5, 0);
        rightGlass.rotation.y = -Math.PI / 2;
        machineGroup.add(rightGlass);
        
        // 后墙 - 彩色背景
        const backWallGeometry = new THREE.PlaneGeometry(10, 9);
        const backWallMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFF69B4,
            shininess: 20
        });
        const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
        backWall.position.set(0, 5, -4.85);
        backWall.castShadow = true;
        machineGroup.add(backWall);
        
        // 机器顶部 - 更厚实
        const topGeometry = new THREE.BoxGeometry(12, 1, 12);
        const topMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2C1810,
            shininess: 30
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 10;
        top.castShadow = true;
        machineGroup.add(top);
        
        // 机器装饰灯带
        const lightStripGeometry = new THREE.BoxGeometry(11, 0.2, 0.2);
        const lightStripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00FFFF,
            emissive: 0x004444
        });
        
        for (let i = 0; i < 3; i++) {
            const lightStrip = new THREE.Mesh(lightStripGeometry, lightStripMaterial);
            lightStrip.position.set(0, 1 + i * 3, 5.1);
            machineGroup.add(lightStrip);
        }
        
        // 出口槽
        const exitGeometry = new THREE.BoxGeometry(2, 1, 1);
        const exitMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const exit = new THREE.Mesh(exitGeometry, exitMaterial);
        exit.position.set(6, 0.5, 0);
        exit.castShadow = true;
        machineGroup.add(exit);
        
        // 控制面板
        const panelGeometry = new THREE.BoxGeometry(3, 1.5, 0.5);
        const panelMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(0, 1, 5.5);
        panel.castShadow = true;
        machineGroup.add(panel);
        
        this.scene.add(machineGroup);
    }
    
    createClaw() {
        this.clawGroup = new THREE.Group();
        
        // 轨道系统
        const railMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 50 });
        
        // X轴轨道
        const xRailGeometry = new THREE.BoxGeometry(9, 0.2, 0.2);
        const xRail1 = new THREE.Mesh(xRailGeometry, railMaterial);
        xRail1.position.set(0, 9, -4);
        xRail1.castShadow = true;
        this.clawGroup.add(xRail1);
        
        const xRail2 = new THREE.Mesh(xRailGeometry, railMaterial);
        xRail2.position.set(0, 9, 4);
        xRail2.castShadow = true;
        this.clawGroup.add(xRail2);
        
        // Z轴轨道
        const zRailGeometry = new THREE.BoxGeometry(0.2, 0.2, 8);
        const zRail1 = new THREE.Mesh(zRailGeometry, railMaterial);
        zRail1.position.set(-4, 9, 0);
        zRail1.castShadow = true;
        this.clawGroup.add(zRail1);
        
        const zRail2 = new THREE.Mesh(zRailGeometry, railMaterial);
        zRail2.position.set(4, 9, 0);
        zRail2.castShadow = true;
        this.clawGroup.add(zRail2);
        
        // 机械臂滑块
        const sliderGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.8);
        const sliderMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 30 });
        const slider = new THREE.Mesh(sliderGeometry, sliderMaterial);
        slider.position.y = 9.2;
        slider.castShadow = true;
        this.clawGroup.add(slider);
        
        // 机械臂主体 - 更粗壮
        const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 2);
        const armMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x666666,
            shininess: 40
        });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.y = this.clawHeight - 1;
        arm.castShadow = true;
        this.clawGroup.add(arm);
        
        // 机械爪连接器
        const connectorGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3);
        const connectorMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
        connector.position.y = this.clawHeight - 2.2;
        connector.castShadow = true;
        this.clawGroup.add(connector);
        
        // 机械爪 - 更逼真的设计
        const clawMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            shininess: 60
        });
        
        // 爪子部分 - 3个爪子
        for (let i = 0; i < 3; i++) {
            const clawGroup = new THREE.Group();
            
            // 主爪身
            const clawBodyGeometry = new THREE.BoxGeometry(0.15, 0.8, 0.1);
            const clawBody = new THREE.Mesh(clawBodyGeometry, clawMaterial);
            clawBody.position.y = -0.4;
            clawGroup.add(clawBody);
            
            // 爪尖
            const clawTipGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
            const clawTip = new THREE.Mesh(clawTipGeometry, clawMaterial);
            clawTip.position.y = -0.9;
            clawTip.rotation.x = Math.PI;
            clawGroup.add(clawTip);
            
            // 爪子关节
            const jointGeometry = new THREE.SphereGeometry(0.08);
            const joint = new THREE.Mesh(jointGeometry, clawMaterial);
            joint.position.y = 0;
            clawGroup.add(joint);
            
            const angle = (i * Math.PI * 2) / 3;
            clawGroup.position.x = Math.cos(angle) * 0.25;
            clawGroup.position.z = Math.sin(angle) * 0.25;
            clawGroup.position.y = this.clawHeight - 2.4;
            clawGroup.rotation.y = angle;
            clawGroup.castShadow = true;
            
            this.clawParts.push(clawGroup);
            this.clawGroup.add(clawGroup);
        }
        
        // 钢缆
        const cableGeometry = new THREE.CylinderGeometry(0.02, 0.02, 2);
        const cableMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const cable = new THREE.Mesh(cableGeometry, cableMaterial);
        cable.position.y = this.clawHeight - 1;
        this.clawGroup.add(cable);
        
        // 创建物理体
        const clawShape = new CANNON.Sphere(0.4);
        this.clawBody = new CANNON.Body({ mass: 1 });
        this.clawBody.addShape(clawShape);
        this.clawBody.position.set(0, this.clawHeight, 0);
        this.world.add(this.clawBody);
        
        this.scene.add(this.clawGroup);
    }
    
    createToys() {
        const toyTypes = [
            { type: 'bear', color: 0x8B4513, name: '小熊' },
            { type: 'rabbit', color: 0xFFB6C1, name: '兔子' },
            { type: 'duck', color: 0xFFFF00, name: '小鸭' },
            { type: 'cat', color: 0x808080, name: '小猫' },
            { type: 'pig', color: 0xFFC0CB, name: '小猪' },
            { type: 'panda', color: 0x000000, name: '熊猫' }
        ];
        
        for (let i = 0; i < 12; i++) {
            const toyType = toyTypes[Math.floor(Math.random() * toyTypes.length)];
            const toyGroup = this.createToyModel(toyType);
            
            // 随机位置
            toyGroup.position.x = (Math.random() - 0.5) * 8;
            toyGroup.position.y = 1 + Math.random() * 1.5;
            toyGroup.position.z = (Math.random() - 0.5) * 8;
            
            toyGroup.castShadow = true;
            toyGroup.receiveShadow = true;
            toyGroup.userData = { type: toyType.type, name: toyType.name };
            
            this.toys.push(toyGroup);
            this.scene.add(toyGroup);
            
            // 创建物理体 - 使用球形简化
            const toyShape = new CANNON.Sphere(0.6);
            const toyBody = new CANNON.Body({ mass: 0.8 });
            toyBody.addShape(toyShape);
            toyBody.position.copy(toyGroup.position);
            
            this.world.add(toyBody);
            this.toyBodies.push(toyBody);
        }
        
        this.updateToyCount();
    }
    
    createToyModel(toyType) {
        const toyGroup = new THREE.Group();
        const mainColor = toyType.color;
        
        switch (toyType.type) {
            case 'bear':
                return this.createBear(mainColor);
            case 'rabbit':
                return this.createRabbit(mainColor);
            case 'duck':
                return this.createDuck(mainColor);
            case 'cat':
                return this.createCat(mainColor);
            case 'pig':
                return this.createPig(mainColor);
            case 'panda':
                return this.createPanda();
            default:
                return this.createBear(mainColor);
        }
    }
    
    createBear(color) {
        const bearGroup = new THREE.Group();
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 20 });
        
        // 身体
        const bodyGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0;
        body.scale.y = 1.2;
        bearGroup.add(body);
        
        // 头
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.y = 0.7;
        bearGroup.add(head);
        
        // 耳朵
        const earGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const leftEar = new THREE.Mesh(earGeometry, material);
        leftEar.position.set(-0.25, 0.9, 0.1);
        bearGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, material);
        rightEar.position.set(0.25, 0.9, 0.1);
        bearGroup.add(rightEar);
        
        // 眼睛
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.75, 0.3);
        bearGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.75, 0.3);
        bearGroup.add(rightEye);
        
        // 鼻子
        const noseGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const nose = new THREE.Mesh(noseGeometry, eyeMaterial);
        nose.position.set(0, 0.68, 0.32);
        bearGroup.add(nose);
        
        // 四肢
        const limbGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const limbs = [
            { pos: [-0.4, -0.3, 0.2] },  // 左前腿
            { pos: [0.4, -0.3, 0.2] },   // 右前腿
            { pos: [-0.3, -0.5, -0.1] }, // 左后腿
            { pos: [0.3, -0.5, -0.1] }   // 右后腿
        ];
        
        limbs.forEach(limb => {
            const limbMesh = new THREE.Mesh(limbGeometry, material);
            limbMesh.position.set(...limb.pos);
            limbMesh.scale.y = 1.5;
            bearGroup.add(limbMesh);
        });
        
        return bearGroup;
    }
    
    createRabbit(color) {
        const rabbitGroup = new THREE.Group();
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 20 });
        
        // 身体
        const bodyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0;
        body.scale.y = 1.3;
        rabbitGroup.add(body);
        
        // 头
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.y = 0.6;
        rabbitGroup.add(head);
        
        // 长耳朵
        const earGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const leftEar = new THREE.Mesh(earGeometry, material);
        leftEar.position.set(-0.15, 0.9, 0);
        leftEar.scale.y = 2.5;
        rabbitGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, material);
        rightEar.position.set(0.15, 0.9, 0);
        rightEar.scale.y = 2.5;
        rabbitGroup.add(rightEar);
        
        // 眼睛
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.65, 0.25);
        rabbitGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.65, 0.25);
        rabbitGroup.add(rightEye);
        
        // 小尾巴
        const tailGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const tail = new THREE.Mesh(tailGeometry, material);
        tail.position.set(0, 0.1, -0.45);
        rabbitGroup.add(tail);
        
        return rabbitGroup;
    }
    
    createDuck(color) {
        const duckGroup = new THREE.Group();
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 30 });
        
        // 身体
        const bodyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0;
        body.scale.z = 1.3;
        duckGroup.add(body);
        
        // 头
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.set(0, 0.5, 0.2);
        duckGroup.add(head);
        
        // 嘴巴
        const beakGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
        const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xFFA500 });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0, 0.5, 0.4);
        beak.rotation.x = Math.PI / 2;
        duckGroup.add(beak);
        
        // 眼睛
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.55, 0.3);
        duckGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.55, 0.3);
        duckGroup.add(rightEye);
        
        return duckGroup;
    }
    
    createCat(color) {
        const catGroup = new THREE.Group();
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 20 });
        
        // 身体
        const bodyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0;
        body.scale.z = 1.4;
        catGroup.add(body);
        
        // 头
        const headGeometry = new THREE.SphereGeometry(0.28, 16, 16);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.y = 0.55;
        catGroup.add(head);
        
        // 猫耳朵 - 三角形
        const earGeometry = new THREE.ConeGeometry(0.08, 0.15, 3);
        const leftEar = new THREE.Mesh(earGeometry, material);
        leftEar.position.set(-0.15, 0.8, 0);
        catGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, material);
        rightEar.position.set(0.15, 0.8, 0);
        catGroup.add(rightEar);
        
        // 眼睛 - 猫眼形状
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.6, 0.25);
        leftEye.scale.y = 1.5;
        catGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.6, 0.25);
        rightEye.scale.y = 1.5;
        catGroup.add(rightEye);
        
        // 尾巴
        const tailGeometry = new THREE.CylinderGeometry(0.03, 0.06, 0.8, 8);
        const tail = new THREE.Mesh(tailGeometry, material);
        tail.position.set(0, 0.3, -0.6);
        tail.rotation.x = Math.PI / 3;
        catGroup.add(tail);
        
        return catGroup;
    }
    
    createPig(color) {
        const pigGroup = new THREE.Group();
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 20 });
        
        // 身体
        const bodyGeometry = new THREE.SphereGeometry(0.45, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0;
        body.scale.z = 1.2;
        pigGroup.add(body);
        
        // 头
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.y = 0.6;
        pigGroup.add(head);
        
        // 猪鼻子
        const snoutGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.1, 8);
        const snout = new THREE.Mesh(snoutGeometry, material);
        snout.position.set(0, 0.55, 0.32);
        snout.rotation.x = Math.PI / 2;
        pigGroup.add(snout);
        
        // 鼻孔
        const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const nostrilGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        
        const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
        leftNostril.position.set(-0.03, 0.55, 0.37);
        pigGroup.add(leftNostril);
        
        const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
        rightNostril.position.set(0.03, 0.55, 0.37);
        pigGroup.add(rightNostril);
        
        // 眼睛
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.65, 0.25);
        pigGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.65, 0.25);
        pigGroup.add(rightEye);
        
        // 小耳朵
        const earGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const leftEar = new THREE.Mesh(earGeometry, material);
        leftEar.position.set(-0.2, 0.8, 0.1);
        leftEar.scale.y = 0.7;
        pigGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, material);
        rightEar.position.set(0.2, 0.8, 0.1);
        rightEar.scale.y = 0.7;
        pigGroup.add(rightEar);
        
        return pigGroup;
    }
    
    createPanda() {
        const pandaGroup = new THREE.Group();
        const whiteMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 20 });
        const blackMaterial = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 20 });
        
        // 身体 - 白色
        const bodyGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const body = new THREE.Mesh(bodyGeometry, whiteMaterial);
        body.position.y = 0;
        body.scale.y = 1.2;
        pandaGroup.add(body);
        
        // 头 - 白色
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const head = new THREE.Mesh(headGeometry, whiteMaterial);
        head.position.y = 0.7;
        pandaGroup.add(head);
        
        // 黑色耳朵
        const earGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const leftEar = new THREE.Mesh(earGeometry, blackMaterial);
        leftEar.position.set(-0.25, 0.9, 0.1);
        pandaGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, blackMaterial);
        rightEar.position.set(0.25, 0.9, 0.1);
        pandaGroup.add(rightEar);
        
        // 黑色眼圈
        const eyePatchGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const leftEyePatch = new THREE.Mesh(eyePatchGeometry, blackMaterial);
        leftEyePatch.position.set(-0.15, 0.75, 0.25);
        leftEyePatch.scale.z = 0.3;
        pandaGroup.add(leftEyePatch);
        
        const rightEyePatch = new THREE.Mesh(eyePatchGeometry, blackMaterial);
        rightEyePatch.position.set(0.15, 0.75, 0.25);
        rightEyePatch.scale.z = 0.3;
        pandaGroup.add(rightEyePatch);
        
        // 眼睛
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 0.75, 0.32);
        pandaGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 0.75, 0.32);
        pandaGroup.add(rightEye);
        
        // 黑色鼻子
        const noseGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const nose = new THREE.Mesh(noseGeometry, blackMaterial);
        nose.position.set(0, 0.68, 0.32);
        pandaGroup.add(nose);
        
        // 黑色四肢
        const limbGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const limbs = [
            { pos: [-0.4, -0.3, 0.2] },  // 左前腿
            { pos: [0.4, -0.3, 0.2] },   // 右前腿
            { pos: [-0.3, -0.5, -0.1] }, // 左后腿
            { pos: [0.3, -0.5, -0.1] }   // 右后腿
        ];
        
        limbs.forEach(limb => {
            const limbMesh = new THREE.Mesh(limbGeometry, blackMaterial);
            limbMesh.position.set(...limb.pos);
            limbMesh.scale.y = 1.5;
            pandaGroup.add(limbMesh);
        });
        
        return pandaGroup;
    }
    
    setupLights() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 主光源
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 点光源
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
        pointLight.position.set(0, 8, 0);
        this.scene.add(pointLight);
    }
    
    setupControls() {
        // 键盘控制
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = true;
                    break;
                case 'Space':
                    event.preventDefault();
                    this.grab();
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = false;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = false;
                    break;
            }
        });
        
        // 按钮控制
        document.getElementById('leftBtn').addEventListener('click', () => {
            this.moveClawInstant(-1, 0);
        });
        
        document.getElementById('rightBtn').addEventListener('click', () => {
            this.moveClawInstant(1, 0);
        });
        
        document.getElementById('upBtn').addEventListener('click', () => {
            this.moveClawInstant(0, -1);
        });
        
        document.getElementById('downBtn').addEventListener('click', () => {
            this.moveClawInstant(0, 1);
        });
        
        document.getElementById('grabBtn').addEventListener('click', () => {
            this.grab();
        });
    }
    
    moveClawInstant(deltaX, deltaZ) {
        if (this.gameState !== 'idle') return;
        
        this.clawPosition.x += deltaX * 0.8;
        this.clawPosition.z += deltaZ * 0.8;
        
        // 限制边界
        this.clawPosition.x = Math.max(-4, Math.min(4, this.clawPosition.x));
        this.clawPosition.z = Math.max(-4, Math.min(4, this.clawPosition.z));
    }
    
    updateClawMovement() {
        if (this.gameState !== 'idle') return;
        
        // 连续移动
        if (this.keys.left) {
            this.clawPosition.x -= this.clawSpeed;
        }
        if (this.keys.right) {
            this.clawPosition.x += this.clawSpeed;
        }
        if (this.keys.up) {
            this.clawPosition.z -= this.clawSpeed;
        }
        if (this.keys.down) {
            this.clawPosition.z += this.clawSpeed;
        }
        
        // 限制边界
        this.clawPosition.x = Math.max(-4, Math.min(4, this.clawPosition.x));
        this.clawPosition.z = Math.max(-4, Math.min(4, this.clawPosition.z));
    }
    
    grab() {
        if (this.gameState !== 'idle') return;
        
        this.gameState = 'grabbing';
        this.updateStatus('🎯 抓取中...');
        
        // 下降动画
        this.animateClawDown();
    }
    
    animateClawDown() {
        const startHeight = this.clawHeight;
        const endHeight = 1;
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.clawHeight = startHeight + (endHeight - startHeight) * progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 检查抓取
                setTimeout(() => {
                    this.checkGrab();
                    this.animateClawUp();
                }, 500);
            }
        };
        
        animate();
    }
    
    animateClawUp() {
        const startHeight = this.clawHeight;
        const endHeight = 8;
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.clawHeight = startHeight + (endHeight - startHeight) * progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 检查是否抓到了东西
                if (this.isGrabbing) {
                    setTimeout(() => {
                        this.dropToy();
                    }, 1000);
                } else {
                    this.gameState = 'idle';
                    this.updateStatus('使用方向键移动机械臂');
                }
            }
        };
        
        animate();
    }
    
    checkGrab() {
        const clawWorldPos = new THREE.Vector3(
            this.clawPosition.x,
            this.clawHeight,
            this.clawPosition.z
        );
        
        for (let i = 0; i < this.toys.length; i++) {
            const toy = this.toys[i];
            const distance = clawWorldPos.distanceTo(toy.position);
            
            if (distance < 1.2) {
                this.isGrabbing = true;
                this.grabbedToy = toy;
                this.grabbedToyIndex = i;
                
                // 移除物理体
                this.world.remove(this.toyBodies[i]);
                
                const toyName = toy.userData ? toy.userData.name : '娃娃';
                this.updateStatus(`🎉 抓到${toyName}了！`);
                return;
            }
        }
        
        this.updateStatus('😅 没抓到...');
    }
    
    dropToy() {
        if (!this.isGrabbing || !this.grabbedToy) return;
        
        // 移动到出口位置
        this.grabbedToy.position.set(6, 2, 0);
        
        // 增加分数
        this.score += 10;
        this.updateScore();
        
        // 移除娃娃
        this.scene.remove(this.grabbedToy);
        this.toys.splice(this.grabbedToyIndex, 1);
        this.toyBodies.splice(this.grabbedToyIndex, 1);
        
        this.isGrabbing = false;
        this.grabbedToy = null;
        this.gameState = 'idle';
        this.updateStatus('🎊 恭喜！继续游戏');
        this.updateToyCount();
        
        // 如果娃娃不够了，重新生成
        if (this.toys.length < 5) {
            this.createMoreToys();
        }
    }
    
    createMoreToys() {
        const toyColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3];
        
        for (let i = 0; i < 5; i++) {
            const toyGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const toyMaterial = new THREE.MeshLambertMaterial({ 
                color: toyColors[Math.floor(Math.random() * toyColors.length)] 
            });
            const toy = new THREE.Mesh(toyGeometry, toyMaterial);
            
            toy.position.x = (Math.random() - 0.5) * 8;
            toy.position.y = 8;
            toy.position.z = (Math.random() - 0.5) * 8;
            
            toy.castShadow = true;
            toy.receiveShadow = true;
            
            this.toys.push(toy);
            this.scene.add(toy);
            
            const toyShape = new CANNON.Sphere(0.5);
            const toyBody = new CANNON.Body({ mass: 1 });
            toyBody.addShape(toyShape);
            toyBody.position.copy(toy.position);
            
            this.world.add(toyBody);
            this.toyBodies.push(toyBody);
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = `🏆 得分: ${this.score}`;
    }
    
    updateToyCount() {
        document.getElementById('toyCount').textContent = this.toys.length;
    }
    
    startGameTimer() {
        this.gameTimeInterval = setInterval(() => {
            const elapsed = Date.now() - this.gameStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            document.getElementById('gameTime').textContent = timeString;
        }, 1000);
    }
    
    updateStatus(message) {
        document.getElementById('status').textContent = `🎯 ${message}`;
    }
    
    createParticles() {
        // 创建浮动粒子效果
        setInterval(() => {
            if (Math.random() < 0.3) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 2 + 's';
                particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
                document.body.appendChild(particle);
                
                // 3秒后移除粒子
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 5000);
            }
        }, 500);
    }
    
    showGameTitle() {
        const title = document.getElementById('gameTitle');
        title.classList.add('show');
        
        // 3秒后淡出标题
        setTimeout(() => {
            title.style.opacity = '0';
        }, 3000);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // 更新物理世界
        this.world.step(deltaTime);
        
        // 更新机械臂移动
        this.updateClawMovement();
        
        // 更新机械臂位置
        this.clawGroup.position.x = this.clawPosition.x;
        this.clawGroup.position.z = this.clawPosition.z;
        this.clawBody.position.set(this.clawPosition.x, this.clawHeight, this.clawPosition.z);
        
        // 更新机械臂高度
        this.clawGroup.children.forEach((child, index) => {
            if (index === 0) { // 主臂
                child.position.y = this.clawHeight - 1;
            } else { // 爪子
                child.position.y = this.clawHeight - 2.4;
            }
        });
        
        // 更新娃娃位置
        for (let i = 0; i < this.toys.length; i++) {
            if (this.toyBodies[i]) {
                this.toys[i].position.copy(this.toyBodies[i].position);
                this.toys[i].quaternion.copy(this.toyBodies[i].quaternion);
            }
        }
        
        // 如果正在抓取，让娃娃跟随机械臂
        if (this.isGrabbing && this.grabbedToy) {
            this.grabbedToy.position.set(
                this.clawPosition.x,
                this.clawHeight - 1.5,
                this.clawPosition.z
            );
        }
        
        // 渲染场景
        this.renderer.render(this.scene, this.camera);
    }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new ClawMachineGame();
}); 