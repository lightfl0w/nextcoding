import { Avatar, Button, Description, Dropdown, Label } from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { useAuth } from "~/hooks/useAuth";

export function UserInfo() {
    const { user, isPending } = useAuth();

    if (isPending) {
        return <div className="h-10" aria-hidden />;
    }

    if (!user) {
        return (
            <Button variant="secondary" fullWidth>
                登录
            </Button>
        );
    }

    return (
        <Dropdown>
            <Dropdown.Trigger>
                <div className="flex items-center gap-2">
                    <Avatar size="md">
                        {user.image ? (
                            <Avatar.Image alt={user.name} src={user.image} />
                        ) : null}
                        <Avatar.Fallback>
                            {user.name?.charAt(0).toUpperCase() ?? "?"}
                        </Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                        <Label className="w-full text-left">
                            {user.name ?? "未命名"}
                        </Label>
                        <Description className="w-full text-left">
                            {user.email}
                        </Description>
                    </div>
                </div>
            </Dropdown.Trigger>
            <Dropdown.Popover>
                <Dropdown.Menu>
                    <Dropdown.Item>
                        <Label>我的账号</Label>
                    </Dropdown.Item>
                    <Dropdown.Item
                        onAction={() => authClient.signOut()}
                        textValue="退出登录"
                    >
                        <Label>退出登录</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
