import { Avatar, Description, Dropdown, Label } from "@heroui/react";

export function UserInfo() {
    return (
        <Dropdown>
            <Dropdown.Trigger>
                <div className="flex items-center gap-2">
                    <Avatar size="md">
                        <Avatar.Image
                            alt="Bob"
                            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
                        />
                        <Avatar.Fallback>B</Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                        <Label className="w-full text-left">Bob</Label>
                        <Description className="w-full text-left">
                            bob@heroui.com
                        </Description>
                    </div>
                </div>
            </Dropdown.Trigger>
            <Dropdown.Popover>
                <Dropdown.Menu>
                    <Dropdown.Item>
                        <Label>我的账号</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="open-file" textValue="Open file">
                        <Label>退出登录</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
