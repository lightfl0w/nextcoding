import { Avatar, Button, Description, Dropdown, Label } from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "~/hooks/useAuth";

export function UserInfo() {
    const { user, isPending } = useAuth();
    const navigate = useNavigate();

    if (isPending) {
        return <div className="h-10" aria-hidden />;
    }

    if (!user) {
        return (
            <Button
                variant="secondary"
                fullWidth
                onPress={() =>
                    navigate({
                        to: "/auth",
                        search: { mode: "login", redirect: "/" },
                    })
                }
            >
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
                    <Dropdown.Item
                        onAction={() => navigate({ to: "/account" })}
                        textValue="我的账号"
                    >
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
