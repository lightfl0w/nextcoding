import { Avatar, Button, Description, Dropdown, Label } from "@heroui/react";
import { authClient } from "@nextcoding/auth/client";
import { useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";

export function UserInfo() {
    const { user, isPending } = useAuth();
    const navigate = useNavigate();

    if (isPending) {
        return <div className="h-10" aria-hidden />;
    }

    if (!user) {
        return (
            <div className="flex flex-col gap-2">
                <Button
                    variant="secondary"
                    fullWidth
                    className="gap-1.5"
                    onPress={() =>
                        navigate({
                            to: "/auth",
                            search: { mode: "login", redirect: "/" },
                        })
                    }
                >
                    <LogIn className="size-3.5" />
                    登录
                </Button>
            </div>
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
                        <Label className="text-danger">退出登录</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
